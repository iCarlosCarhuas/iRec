param(
  [switch]$SkipInstall,
  [switch]$SkipDev,
  [switch]$StopAfterCheck,
  [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Ok([string]$Message) {
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Warn([string]$Message) {
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Fail([string]$Message) {
  Write-Host ""
  Write-Host "[FAIL] $Message" -ForegroundColor Red
  exit 1
}

function Run-Cmd([string]$Command) {
  Write-Host "> $Command" -ForegroundColor DarkGray
  & cmd.exe /d /s /c $Command
  $exitCode = $LASTEXITCODE

  if ($exitCode -ne 0) {
    throw "Command failed with exit code ${exitCode}: ${Command}"
  }
}

function Test-Url {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [scriptblock]$Validator = $null
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5

    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400) {
      return $false
    }

    if ($null -ne $Validator) {
      return [bool](& $Validator $response)
    }

    return $true
  }
  catch {
    return $false
  }
}

function Wait-ForUrl {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Url,
    [scriptblock]$Validator = $null,
    [int]$Timeout = 90
  )

  $deadline = (Get-Date).AddSeconds($Timeout)

  do {
    if (Test-Url -Url $Url -Validator $Validator) {
      Ok "$Name -> $Url"
      return $true
    }

    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  Warn "$Name no respondio correctamente en $Timeout segundos: $Url"
  return $false
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

Write-Host ""
Write-Host "================================================" -ForegroundColor DarkCyan
Write-Host " iRec v0.1.0 - Foundation verification" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor DarkCyan
Write-Host "Repo: $RepoRoot"

try {
  Step "Comprobando runtime"

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail "Node.js no esta disponible en PATH."
  }

  if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) {
    Fail "Corepack no esta disponible en PATH."
  }

  $nodeVersion = (& node --version).Trim()
  Write-Host "Node: $nodeVersion"

  Run-Cmd "corepack enable"

  $pnpmVersion = (& cmd.exe /d /s /c "pnpm --version").Trim()
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo ejecutar pnpm."
  }
  Write-Host "pnpm: $pnpmVersion"

  if (-not $SkipInstall) {
    Step "Instalando/sincronizando dependencias"
    Run-Cmd "pnpm install"
    Ok "Dependencias sincronizadas"
  }
  else {
    Warn "Instalacion omitida por -SkipInstall"
  }

  Step "1/3 Typecheck"
  Run-Cmd "pnpm typecheck"
  Ok "Typecheck completo"

  Step "2/3 OpenAPI"
  Run-Cmd "pnpm openapi:check"
  Ok "OpenAPI 3.1 valido"

  Step "3/3 Build"
  Run-Cmd "pnpm build"
  Ok "Build completo"
}
catch {
  Fail $_.Exception.Message
}

if ($SkipDev) {
  Write-Host ""
  Write-Host "================================================" -ForegroundColor DarkGreen
  Write-Host " iRec v0.1.0 STATIC CHECKS PASSED" -ForegroundColor Green
  Write-Host "================================================" -ForegroundColor DarkGreen
  exit 0
}

Step "Smoke test PWA + API + Scalar"

$tmpDir = Join-Path $RepoRoot ".tmp"
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

$stdoutLog = Join-Path $tmpDir "foundation-dev.out.log"
$stderrLog = Join-Path $tmpDir "foundation-dev.err.log"

Remove-Item $stdoutLog -Force -ErrorAction SilentlyContinue
Remove-Item $stderrLog -Force -ErrorAction SilentlyContinue

$healthValidator = {
  param($response)

  try {
    $json = $response.Content | ConvertFrom-Json
    return $json.status -eq "ok" -and $json.service -eq "irec-api"
  }
  catch {
    return $false
  }
}

$openApiValidator = {
  param($response)

  try {
    $json = $response.Content | ConvertFrom-Json
    return $json.openapi -eq "3.1.0" -and $null -ne $json.info
  }
  catch {
    return $false
  }
}

$apiAlreadyUp = Test-Url `
  -Url "http://localhost:3000/api/health/live" `
  -Validator $healthValidator

$webAlreadyUp = Test-Url -Url "http://localhost:4200"

$devProcess = $null

if ($apiAlreadyUp -and $webAlreadyUp) {
  Warn "PWA y API ya estaban ejecutandose; se reutilizaran."
}
else {
  Write-Host "Iniciando pnpm dev en segundo plano..."

  $devProcess = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList "/d", "/s", "/c", "pnpm dev" `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -PassThru

  Write-Host "Launcher PID: $($devProcess.Id)"
  Write-Host "stdout: $stdoutLog"
  Write-Host "stderr: $stderrLog"
}

$results = @()

$results += Wait-ForUrl `
  -Name "PWA" `
  -Url "http://localhost:4200" `
  -Timeout $TimeoutSeconds

$results += Wait-ForUrl `
  -Name "API health" `
  -Url "http://localhost:3000/api/health/live" `
  -Validator $healthValidator `
  -Timeout $TimeoutSeconds

$results += Wait-ForUrl `
  -Name "OpenAPI" `
  -Url "http://localhost:3000/openapi.json" `
  -Validator $openApiValidator `
  -Timeout $TimeoutSeconds

$results += Wait-ForUrl `
  -Name "Scalar" `
  -Url "http://localhost:3000/reference" `
  -Timeout $TimeoutSeconds

if ($results -contains $false) {
  Write-Host ""
  Warn "El smoke test HTTP fallo."

  if (Test-Path $stdoutLog) {
    Write-Host ""
    Write-Host "--- stdout (ultimas 80 lineas) ---" -ForegroundColor DarkGray
    Get-Content $stdoutLog -Tail 80 -ErrorAction SilentlyContinue
  }

  if (Test-Path $stderrLog) {
    Write-Host ""
    Write-Host "--- stderr (ultimas 80 lineas) ---" -ForegroundColor DarkGray
    Get-Content $stderrLog -Tail 80 -ErrorAction SilentlyContinue
  }

  if ($null -ne $devProcess -and -not $devProcess.HasExited) {
    & taskkill.exe /PID $devProcess.Id /T /F | Out-Null
  }

  Fail "Foundation verification FAILED"
}

Write-Host ""
Write-Host "================================================" -ForegroundColor DarkGreen
Write-Host " iRec v0.1.0 FOUNDATION PASSED" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor DarkGreen
Write-Host ""
Write-Host "PWA:     http://localhost:4200"
Write-Host "API:     http://localhost:3000/api/health/live"
Write-Host "OpenAPI: http://localhost:3000/openapi.json"
Write-Host "Scalar:  http://localhost:3000/reference"

if ($null -ne $devProcess -and -not $devProcess.HasExited) {
  if ($StopAfterCheck) {
    Write-Host ""
    Write-Host "Deteniendo entorno por -StopAfterCheck..."
    & taskkill.exe /PID $devProcess.Id /T /F | Out-Null
    Ok "Entorno detenido"
  }
  else {
    Write-Host ""
    Write-Host "El entorno queda ejecutandose." -ForegroundColor Yellow
    Write-Host "Para detener el arbol de procesos:"
    Write-Host "  taskkill /PID $($devProcess.Id) /T /F"
  }
}

Write-Host ""
Write-Host "Git status:"
git status --short
