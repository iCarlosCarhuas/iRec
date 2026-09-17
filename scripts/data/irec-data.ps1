param(
    [Parameter(Position = 0, Mandatory = $true)]
    [ValidateSet("status", "backup", "list", "verify")]
    [string]$Action,

    [string]$BackupPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Container = "irec-postgres"
$DbName = "irec"
$DbUser = "irec"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Invoke-DockerCapture {
    param([string[]]$DockerArgs)
    $output = & docker @DockerArgs 2>&1
    if ($LASTEXITCODE -ne 0) { throw ($output -join "`n") }
    return ($output -join "`n")
}

function Invoke-Docker {
    param([string[]]$DockerArgs)
    & docker @DockerArgs
    if ($LASTEXITCODE -ne 0) { throw "docker fallo con codigo $LASTEXITCODE" }
}

function Get-IrecDataHome {
    if ($env:IREC_DATA_HOME) {
        return [System.IO.Path]::GetFullPath($env:IREC_DATA_HOME)
    }

    $commonDir = (& git -C $RepoRoot rev-parse --git-common-dir).Trim()
    if ($LASTEXITCODE -ne 0) { throw "No se pudo determinar el Git common directory." }

    if ([System.IO.Path]::IsPathRooted($commonDir)) {
        $commonPath = [System.IO.Path]::GetFullPath($commonDir)
    } else {
        $commonPath = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot $commonDir))
    }

    $mainRepository = Split-Path $commonPath -Parent
    $workspaceRoot = Split-Path $mainRepository -Parent
    return (Join-Path $workspaceRoot "iRec-data")
}

$DataHome = Get-IrecDataHome
$BackupRoot = Join-Path $DataHome "backups\postgres\local"

function Get-PostgresInspect {
    $raw = Invoke-DockerCapture @("inspect", $Container)
    $parsed = $raw | ConvertFrom-Json
    if (-not $parsed) { throw "No se pudo inspeccionar $Container." }
    return $parsed[0]
}

function Assert-PostgresRunning {
    try { $inspect = Get-PostgresInspect }
    catch {
        throw @"
No existe el contenedor $Container.

Levanta primero iRec:
powershell.exe -ExecutionPolicy Bypass -File ./scripts/irec.ps1 up
"@
    }

    if (-not $inspect.State.Running) {
        throw "El contenedor $Container existe pero no esta ejecutandose."
    }
    return $inspect
}

function Show-Status {
    $inspect = Assert-PostgresRunning
    $dbSize = Invoke-DockerCapture @("exec", $Container, "psql", "-U", $DbUser, "-d", $DbName, "-Atc", "SELECT pg_size_pretty(pg_database_size(current_database()));")
    $tableCount = Invoke-DockerCapture @("exec", $Container, "psql", "-U", $DbUser, "-d", $DbName, "-Atc", "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';")
    $serverVersion = Invoke-DockerCapture @("exec", $Container, "psql", "-U", $DbUser, "-d", $DbName, "-Atc", "SHOW server_version;")
    $mount = @($inspect.Mounts | Where-Object { $_.Destination -eq "/var/lib/postgresql/data" }) | Select-Object -First 1

    Write-Host ""
    Write-Host "iRec Data Safety"
    Write-Host "----------------"
    Write-Host "Environment : LOCAL"
    Write-Host "Container   : $Container"
    Write-Host "Database    : $DbName"
    Write-Host "PostgreSQL  : $serverVersion"
    Write-Host "DB size     : $dbSize"
    Write-Host "Tables      : $tableCount"
    if ($mount) { Write-Host "Volume      : $($mount.Name)" }
    Write-Host "Backups     : $BackupRoot"
    Write-Host ""
}

function Test-Backup {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Backup no encontrado: $Path" }
    $file = Get-Item -LiteralPath $Path
    if ($file.Length -le 0) { throw "El backup esta vacio." }

    $shaPath = "$Path.sha256"
    if (Test-Path -LiteralPath $shaPath) {
        $expected = (((Get-Content -LiteralPath $shaPath -Raw).Trim() -split "\s+")[0]).ToLowerInvariant()
        $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne $expected) { throw "Checksum SHA-256 invalido." }
        Write-Host "[OK] SHA-256 valido."
    } else {
        Write-Warning "No existe archivo SHA-256 asociado."
    }

    Assert-PostgresRunning | Out-Null
    $tempName = "/tmp/irec-verify-$([guid]::NewGuid().ToString('N')).dump"
    try {
        Invoke-Docker @("cp", $Path, "${Container}:$tempName")
        Invoke-Docker @("exec", $Container, "pg_restore", "-l", $tempName) | Out-Null
        Write-Host "[OK] pg_restore reconoce el backup."
        Write-Host "[OK] Backup verificado: $Path"
    } finally {
        & docker exec $Container rm -f $tempName 2>$null | Out-Null
    }
}

function New-Backup {
    $inspect = Assert-PostgresRunning
    New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null

    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
    $baseName = "irec-local-$timestamp"
    $dumpPath = Join-Path $BackupRoot "$baseName.dump"
    $shaPath = "$dumpPath.sha256"
    $metadataPath = "$dumpPath.json"
    $tempName = "/tmp/$baseName.dump"

    Write-Host "[INFO] Creando backup PostgreSQL..."
    Write-Host "[INFO] Destino: $dumpPath"

    try {
        Invoke-Docker @("exec", $Container, "pg_dump", "-U", $DbUser, "-d", $DbName, "-Fc", "-f", $tempName)
        Invoke-Docker @("cp", "${Container}:$tempName", $dumpPath)
    } finally {
        & docker exec $Container rm -f $tempName 2>$null | Out-Null
    }

    $file = Get-Item -LiteralPath $dumpPath
    if ($file.Length -le 0) { throw "El backup generado esta vacio." }

    $hash = Get-FileHash -LiteralPath $dumpPath -Algorithm SHA256
    "$($hash.Hash.ToLowerInvariant())  $baseName.dump" | Set-Content -LiteralPath $shaPath -Encoding ASCII
    $gitCommit = (& git -C $RepoRoot rev-parse HEAD).Trim()
    $serverVersion = Invoke-DockerCapture @("exec", $Container, "psql", "-U", $DbUser, "-d", $DbName, "-Atc", "SHOW server_version;")

    $metadata = [ordered]@{
        format = "irec-postgres-backup-v1"
        environment = "local"
        database = $DbName
        databaseUser = $DbUser
        container = $Container
        createdAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        postgresVersion = $serverVersion
        gitCommit = $gitCommit
        bytes = $file.Length
        sha256 = $hash.Hash.ToLowerInvariant()
        dockerImage = $inspect.Config.Image
    }

    $metadata | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $metadataPath -Encoding UTF8

    Write-Host "[OK] Dump generado."
    Write-Host "[OK] SHA-256 generado."
    Write-Host "[OK] Metadata generada."
    Test-Backup -Path $dumpPath
}

function Show-Backups {
    if (-not (Test-Path -LiteralPath $BackupRoot)) {
        Write-Host "No existen backups todavia."
        Write-Host "Ruta: $BackupRoot"
        return
    }

    $files = @(Get-ChildItem -LiteralPath $BackupRoot -Filter "*.dump" -File | Sort-Object LastWriteTimeUtc -Descending)
    if ($files.Count -eq 0) {
        Write-Host "No existen backups todavia."
        return
    }

    Write-Host ""
    Write-Host "Backups PostgreSQL iRec"
    Write-Host "-----------------------"
    $files | Select-Object Name, @{ Name = "MB"; Expression = { [math]::Round($_.Length / 1MB, 2) } }, LastWriteTimeUtc | Format-Table -AutoSize
}

switch ($Action) {
    "status" { Show-Status }
    "backup" { New-Backup }
    "list" { Show-Backups }
    "verify" {
        if (-not $BackupPath) {
            if (-not (Test-Path -LiteralPath $BackupRoot)) { throw "No existen backups para verificar." }
            $latest = Get-ChildItem -LiteralPath $BackupRoot -Filter "*.dump" -File | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
            if (-not $latest) { throw "No existen backups para verificar." }
            $BackupPath = $latest.FullName
        }
        Test-Backup -Path ([System.IO.Path]::GetFullPath($BackupPath))
    }
}
