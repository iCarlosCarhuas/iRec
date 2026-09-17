param(
    [Parameter(Position = 0, Mandatory = $true)]
    [ValidateSet("status", "backup", "list", "verify", "restore-test", "restore")]
    [string]$Action,

    [string]$BackupPath,

    [string]$Confirmation
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Container = "irec-postgres"
$ApiContainer = "irec-api"
$WebContainer = "irec-web"
$DbName = "irec"
$DbUser = "irec"
$RestorePhrase = "RESTORE IREC LOCAL"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$script:LastBackupPath = $null

function Invoke-DockerCapture {
    param([string[]]$DockerArgs)

    $output = & docker @DockerArgs 2>&1

    if ($LASTEXITCODE -ne 0) {
        throw ($output -join "`n")
    }

    return ($output -join "`n")
}

function Invoke-Docker {
    param([string[]]$DockerArgs)

    & docker @DockerArgs | Out-Host

    if ($LASTEXITCODE -ne 0) {
        throw "docker fallo con codigo $LASTEXITCODE"
    }
}

function Invoke-Compose {
    param([string[]]$ComposeArgs)

    Push-Location $RepoRoot
    try {
        & docker compose @ComposeArgs | Out-Host

        if ($LASTEXITCODE -ne 0) {
            throw "docker compose fallo con codigo $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Get-IrecDataHome {
    if ($env:IREC_DATA_HOME) {
        return [System.IO.Path]::GetFullPath($env:IREC_DATA_HOME)
    }

    $commonDir = (& git -C $RepoRoot rev-parse --git-common-dir).Trim()

    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo determinar el Git common directory."
    }

    if ([System.IO.Path]::IsPathRooted($commonDir)) {
        $commonPath = [System.IO.Path]::GetFullPath($commonDir)
    }
    else {
        $commonPath = [System.IO.Path]::GetFullPath(
            (Join-Path $RepoRoot $commonDir)
        )
    }

    # .../iRec/.git -> .../iRec -> .../MVP
    $mainRepository = Split-Path $commonPath -Parent
    $workspaceRoot = Split-Path $mainRepository -Parent

    return (Join-Path $workspaceRoot "iRec-data")
}

$DataHome = Get-IrecDataHome
$BackupRoot = Join-Path $DataHome "backups\postgres\local"

function Get-ContainerInspect {
    param([string]$Name)

    try {
        $raw = Invoke-DockerCapture @("inspect", $Name)
        $parsed = $raw | ConvertFrom-Json

        if (-not $parsed) {
            return $null
        }

        return $parsed[0]
    }
    catch {
        return $null
    }
}

function Test-ContainerRunning {
    param([string]$Name)

    $inspect = Get-ContainerInspect -Name $Name

    if (-not $inspect) {
        return $false
    }

    return [bool]$inspect.State.Running
}

function Assert-PostgresRunning {
    $inspect = Get-ContainerInspect -Name $Container

    if (-not $inspect) {
        throw @"
[BLOCKED] No existe el contenedor $Container.

Levanta iRec con:
powershell.exe -ExecutionPolicy Bypass -File ./scripts/irec.ps1 up

No se realizaron cambios en los datos.
"@
    }

    if (-not $inspect.State.Running) {
        throw @"
[BLOCKED] PostgreSQL esta detenido.

Levanta iRec con:
powershell.exe -ExecutionPolicy Bypass -File ./scripts/irec.ps1 up

No se realizaron cambios en los datos.
"@
    }

    return $inspect
}

function Resolve-BackupPath {
    param([string]$RequestedPath)

    if ($RequestedPath) {
        return [System.IO.Path]::GetFullPath($RequestedPath)
    }

    if (-not (Test-Path -LiteralPath $BackupRoot)) {
        throw "No existen backups disponibles."
    }

    $latest = Get-ChildItem `
        -LiteralPath $BackupRoot `
        -Filter "*.dump" `
        -File |
        Where-Object {
            $_.Name -notlike "irec-local-emergency-pre-restore-*"
        } |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1

    if (-not $latest) {
        throw "No existen backups normales disponibles."
    }

    return $latest.FullName
}

function Show-Status {
    $inspect = Assert-PostgresRunning

    $dbSize = Invoke-DockerCapture @(
        "exec", $Container,
        "psql",
        "-U", $DbUser,
        "-d", $DbName,
        "-Atc",
        "SELECT pg_size_pretty(pg_database_size(current_database()));"
    )

    $tableCount = Invoke-DockerCapture @(
        "exec", $Container,
        "psql",
        "-U", $DbUser,
        "-d", $DbName,
        "-Atc",
        "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';"
    )

    $serverVersion = Invoke-DockerCapture @(
        "exec", $Container,
        "psql",
        "-U", $DbUser,
        "-d", $DbName,
        "-Atc",
        "SHOW server_version;"
    )

    $mount = @(
        $inspect.Mounts |
            Where-Object {
                $_.Destination -eq "/var/lib/postgresql/data"
            }
    ) | Select-Object -First 1

    Write-Host ""
    Write-Host "iRec Data Safety"
    Write-Host "----------------"
    Write-Host "Environment : LOCAL"
    Write-Host "Container   : $Container"
    Write-Host "Database    : $DbName"
    Write-Host "PostgreSQL  : $serverVersion"
    Write-Host "DB size     : $dbSize"
    Write-Host "Tables      : $tableCount"

    if ($mount) {
        Write-Host "Volume      : $($mount.Name)"
    }

    Write-Host "Backups     : $BackupRoot"
    Write-Host ""
}

function Test-Backup {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Backup no encontrado: $Path"
    }

    $file = Get-Item -LiteralPath $Path

    if ($file.Length -le 0) {
        throw "El backup esta vacio."
    }

    $shaPath = "$Path.sha256"

    if (Test-Path -LiteralPath $shaPath) {
        $expected = (
            (Get-Content -LiteralPath $shaPath -Raw).Trim() -split "\s+"
        )[0].ToLowerInvariant()

        $actual = (
            Get-FileHash -LiteralPath $Path -Algorithm SHA256
        ).Hash.ToLowerInvariant()

        if ($actual -ne $expected) {
            throw "Checksum SHA-256 invalido."
        }

        Write-Host "[OK] SHA-256 valido."
    }
    else {
        throw "Falta el archivo SHA-256 asociado: $shaPath"
    }

    Assert-PostgresRunning | Out-Null

    $tempName = "/tmp/irec-verify-$([guid]::NewGuid().ToString('N')).dump"

    try {
        Invoke-Docker @(
            "cp",
            $Path,
            "${Container}:$tempName"
        )

        Invoke-DockerCapture @(
            "exec",
            $Container,
            "pg_restore",
            "-l",
            $tempName
        ) | Out-Null

        Write-Host "[OK] pg_restore reconoce el backup."
        Write-Host "[OK] Backup verificado: $Path"
    }
    finally {
        & docker exec $Container rm -f $tempName 2>$null | Out-Null
    }
}

function New-Backup {
    param(
        [ValidateSet("normal", "emergency")]
        [string]$Kind = "normal"
    )

    $inspect = Assert-PostgresRunning

    New-Item `
        -ItemType Directory `
        -Path $BackupRoot `
        -Force |
        Out-Null

    $timestamp = (Get-Date).ToUniversalTime().ToString(
        "yyyyMMddTHHmmssZ"
    )

    if ($Kind -eq "emergency") {
        $baseName = "irec-local-emergency-pre-restore-$timestamp"
    }
    else {
        $baseName = "irec-local-$timestamp"
    }

    $dumpPath = Join-Path $BackupRoot "$baseName.dump"
    $shaPath = "$dumpPath.sha256"
    $metadataPath = "$dumpPath.json"
    $tempName = "/tmp/$baseName.dump"

    Write-Host "[INFO] Creando backup PostgreSQL ($Kind)..."
    Write-Host "[INFO] Destino: $dumpPath"

    try {
        Invoke-Docker @(
            "exec",
            $Container,
            "pg_dump",
            "-U", $DbUser,
            "-d", $DbName,
            "-Fc",
            "-f", $tempName
        )

        Invoke-Docker @(
            "cp",
            "${Container}:$tempName",
            $dumpPath
        )
    }
    finally {
        & docker exec $Container rm -f $tempName 2>$null | Out-Null
    }

    $file = Get-Item -LiteralPath $dumpPath

    if ($file.Length -le 0) {
        throw "El backup generado esta vacio."
    }

    $hash = Get-FileHash `
        -LiteralPath $dumpPath `
        -Algorithm SHA256

    "$($hash.Hash.ToLowerInvariant())  $baseName.dump" |
        Set-Content `
            -LiteralPath $shaPath `
            -Encoding ASCII

    $gitCommit = (& git -C $RepoRoot rev-parse HEAD).Trim()

    $serverVersion = Invoke-DockerCapture @(
        "exec", $Container,
        "psql",
        "-U", $DbUser,
        "-d", $DbName,
        "-Atc",
        "SHOW server_version;"
    )

    $metadata = [ordered]@{
        format            = "irec-postgres-backup-v1"
        environment       = "local"
        kind              = $Kind
        database          = $DbName
        databaseUser      = $DbUser
        container         = $Container
        createdAtUtc      = (Get-Date).ToUniversalTime().ToString("o")
        postgresVersion   = $serverVersion
        gitCommit         = $gitCommit
        bytes             = $file.Length
        sha256            = $hash.Hash.ToLowerInvariant()
        dockerImage       = $inspect.Config.Image
    }

    $metadata |
        ConvertTo-Json -Depth 5 |
        Set-Content `
            -LiteralPath $metadataPath `
            -Encoding UTF8

    Write-Host "[OK] Dump generado."
    Write-Host "[OK] SHA-256 generado."
    Write-Host "[OK] Metadata generada."

    Test-Backup -Path $dumpPath

    $script:LastBackupPath = $dumpPath
}

function Show-Backups {
    if (-not (Test-Path -LiteralPath $BackupRoot)) {
        Write-Host "No existen backups todavia."
        Write-Host "Ruta: $BackupRoot"
        return
    }

    $files = @(
        Get-ChildItem `
            -LiteralPath $BackupRoot `
            -Filter "*.dump" `
            -File |
            Sort-Object LastWriteTimeUtc -Descending
    )

    if ($files.Count -eq 0) {
        Write-Host "No existen backups todavia."
        return
    }

    Write-Host ""
    Write-Host "Backups PostgreSQL iRec"
    Write-Host "-----------------------"

    $files |
        Select-Object `
            Name,
            @{ Name = "MB"; Expression = {
                [math]::Round($_.Length / 1MB, 2)
            }},
            @{ Name = "Kind"; Expression = {
                if ($_.Name -like "irec-local-emergency-pre-restore-*") {
                    "emergency"
                }
                else {
                    "normal"
                }
            }},
            LastWriteTimeUtc |
        Format-Table -AutoSize
}

function Test-RestoreIntoTemporaryDatabase {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    Test-Backup -Path $Path

    $testDb = "irec_restore_test_" + (
        (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmss")
    )

    $tempName = "/tmp/irec-restore-test-$([guid]::NewGuid().ToString('N')).dump"

    Write-Host ""
    Write-Host "[INFO] Restore de prueba aislado."
    Write-Host "[INFO] Base temporal: $testDb"
    Write-Host "[INFO] La base original '$DbName' NO sera modificada."

    try {
        Invoke-Docker @(
            "cp",
            $Path,
            "${Container}:$tempName"
        )

        Invoke-Docker @(
            "exec",
            $Container,
            "psql",
            "-U", $DbUser,
            "-d", "postgres",
            "-v", "ON_ERROR_STOP=1",
            "-c", "CREATE DATABASE $testDb OWNER $DbUser;"
        )

        Invoke-Docker @(
            "exec",
            $Container,
            "pg_restore",
            "-U", $DbUser,
            "-d", $testDb,
            "--no-owner",
            "--no-privileges",
            "--exit-on-error",
            $tempName
        )

        $tableCount = Invoke-DockerCapture @(
            "exec",
            $Container,
            "psql",
            "-U", $DbUser,
            "-d", $testDb,
            "-Atc",
            "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';"
        )

        $connectivity = Invoke-DockerCapture @(
            "exec",
            $Container,
            "psql",
            "-U", $DbUser,
            "-d", $testDb,
            "-Atc",
            "SELECT 1;"
        )

        if ($connectivity.Trim() -ne "1") {
            throw "La base temporal restaurada no responde correctamente."
        }

        Write-Host "[OK] Restore de prueba completado."
        Write-Host "[OK] Tablas public restauradas: $tableCount"
        Write-Host "[OK] La base original '$DbName' permanecio intacta."
    }
    finally {
        & docker exec $Container psql `
            -U $DbUser `
            -d postgres `
            -c "DROP DATABASE IF EXISTS $testDb WITH (FORCE);" `
            2>$null | Out-Null

        & docker exec $Container rm -f $tempName 2>$null | Out-Null
    }
}

function Assert-RestoreConfirmation {
    param([string]$Provided)

    Write-Host ""
    Write-Host "============================================================"
    Write-Host " OPERACION DESTRUCTIVA: RESTORE DE POSTGRESQL LOCAL"
    Write-Host "============================================================"
    Write-Host "La base actual '$DbName' sera reemplazada por el backup."
    Write-Host "Un backup de emergencia del estado actual ya fue creado."
    Write-Host "API y Web se detendran durante la restauracion."
    Write-Host ""

    $answer = $Provided

    if (-not $answer) {
        $answer = Read-Host "Escribe exactamente '$RestorePhrase' para continuar"
    }

    if ($answer -cne $RestorePhrase) {
        throw "Restore cancelado. La frase de confirmacion no coincide."
    }
}

function Restore-Database {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [string]$ProvidedConfirmation
    )

    Assert-PostgresRunning | Out-Null

    Write-Host ""
    Write-Host "[GATE 1] Validando backup antes de cualquier cambio..."
    Test-RestoreIntoTemporaryDatabase -Path $Path

    Write-Host ""
    Write-Host "[GATE 2] Creando backup de emergencia del estado ACTUAL..."
    New-Backup -Kind "emergency"

    $emergencyBackup = $script:LastBackupPath

    if (-not $emergencyBackup) {
        throw "No se pudo confirmar la creacion del backup de emergencia."
    }

    Write-Host "[OK] Backup de emergencia: $emergencyBackup"

    Write-Host ""
    Write-Host "[GATE 3] Confirmacion humana requerida."
    Assert-RestoreConfirmation -Provided $ProvidedConfirmation

    $apiWasRunning = Test-ContainerRunning -Name $ApiContainer
    $webWasRunning = Test-ContainerRunning -Name $WebContainer

    $tempName = "/tmp/irec-restore-$([guid]::NewGuid().ToString('N')).dump"
    $restoreSucceeded = $false

    try {
        if ($webWasRunning) {
            Write-Host "[INFO] Deteniendo $WebContainer..."
            Invoke-Docker @("stop", $WebContainer)
        }

        if ($apiWasRunning) {
            Write-Host "[INFO] Deteniendo $ApiContainer..."
            Invoke-Docker @("stop", $ApiContainer)
        }

        Invoke-Docker @(
            "cp",
            $Path,
            "${Container}:$tempName"
        )

        Write-Host "[INFO] Terminando conexiones activas a '$DbName'..."
        Invoke-Docker @(
            "exec",
            $Container,
            "psql",
            "-U", $DbUser,
            "-d", "postgres",
            "-v", "ON_ERROR_STOP=1",
            "-c",
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DbName' AND pid <> pg_backend_pid();"
        )

        Write-Host "[INFO] Recreando base '$DbName'..."
        Invoke-Docker @(
            "exec",
            $Container,
            "psql",
            "-U", $DbUser,
            "-d", "postgres",
            "-v", "ON_ERROR_STOP=1",
            "-c",
            "DROP DATABASE IF EXISTS $DbName WITH (FORCE);"
        )

        Invoke-Docker @(
            "exec",
            $Container,
            "psql",
            "-U", $DbUser,
            "-d", "postgres",
            "-v", "ON_ERROR_STOP=1",
            "-c",
            "CREATE DATABASE $DbName OWNER $DbUser;"
        )

        Write-Host "[INFO] Restaurando backup..."
        Invoke-Docker @(
            "exec",
            $Container,
            "pg_restore",
            "-U", $DbUser,
            "-d", $DbName,
            "--no-owner",
            "--no-privileges",
            "--exit-on-error",
            $tempName
        )

        $connectivity = Invoke-DockerCapture @(
            "exec",
            $Container,
            "psql",
            "-U", $DbUser,
            "-d", $DbName,
            "-Atc",
            "SELECT 1;"
        )

        if ($connectivity.Trim() -ne "1") {
            throw "PostgreSQL no responde correctamente despues del restore."
        }

        Write-Host "[INFO] Aplicando migraciones pendientes de la version actual..."
        Invoke-Compose @("run", "--rm", "irec-migrate")

        $tableCount = Invoke-DockerCapture @(
            "exec",
            $Container,
            "psql",
            "-U", $DbUser,
            "-d", $DbName,
            "-Atc",
            "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';"
        )

        Write-Host "[OK] PostgreSQL responde."
        Write-Host "[OK] Tablas public actuales: $tableCount"
        Write-Host "[OK] Restore PostgreSQL completado."
        $restoreSucceeded = $true
    }
    catch {
        Write-Host ""
        Write-Host "[CRITICAL] EL RESTORE NO FINALIZO CORRECTAMENTE."
        Write-Host "[CRITICAL] API y Web permaneceran detenidos para evitar escrituras."
        Write-Host "[CRITICAL] Backup de emergencia disponible en:"
        Write-Host "           $emergencyBackup"
        Write-Host ""
        Write-Host "No se ejecutara un segundo restore automaticamente."
        Write-Host "Esto evita encadenar operaciones destructivas sin supervision."
        throw
    }
    finally {
        & docker exec $Container rm -f $tempName 2>$null | Out-Null
    }

    if ($restoreSucceeded) {
        if ($apiWasRunning) {
            Write-Host "[INFO] Iniciando $ApiContainer..."
            Invoke-Compose @("up", "-d", "irec-api")
        }

        if ($webWasRunning) {
            Write-Host "[INFO] Iniciando $WebContainer..."
            Invoke-Compose @("up", "-d", "irec-web")
        }

        Write-Host ""
        Write-Host "[OK] Restore seguro finalizado."
        Write-Host "[OK] Backup restaurado: $Path"
        Write-Host "[OK] Backup pre-restore conservado: $emergencyBackup"
        Write-Host ""
    }
}

switch ($Action) {
    "status" {
        Show-Status
    }

    "backup" {
        New-Backup -Kind "normal"
    }

    "list" {
        Show-Backups
    }

    "verify" {
        $resolved = Resolve-BackupPath -RequestedPath $BackupPath
        Test-Backup -Path $resolved
    }

    "restore-test" {
        $resolved = Resolve-BackupPath -RequestedPath $BackupPath
        Test-RestoreIntoTemporaryDatabase -Path $resolved
    }

    "restore" {
        $resolved = Resolve-BackupPath -RequestedPath $BackupPath
        Restore-Database `
            -Path $resolved `
            -ProvidedConfirmation $Confirmation
    }
}
