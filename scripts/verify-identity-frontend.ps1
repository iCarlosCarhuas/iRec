param(
  [switch]$SkipInstall,
  [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"

function Run([string]$cmd) {
  Write-Host "> $cmd" -ForegroundColor DarkGray
  & cmd.exe /d /s /c $cmd
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo ($LASTEXITCODE): $cmd"
  }
}

function WaitUrl([string]$url, [int]$timeout) {
  $end = (Get-Date).AddSeconds($timeout)

  while ((Get-Date) -lt $end) {
    try {
      $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        return $true
      }
    } catch {}

    Start-Sleep -Seconds 2
  }

  return $false
}

function GetPortOwner([int]$port) {
  return Get-NetTCPConnection `
    -LocalPort $port `
    -State Listen `
    -ErrorAction SilentlyContinue |
    Select-Object -First 1
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

Write-Host "== iRec v0.2.0 Identity frontend gate ==" -ForegroundColor Cyan

if (-not $SkipInstall) {
  Run "pnpm install"
}

Run "pnpm --filter @irec/contracts build"
Run "pnpm --filter @irec/contracts typecheck"
Run "pnpm --filter @irec/web typecheck"
Run "pnpm --filter @irec/web build"

Write-Host ""
Write-Host "Comprobando backend Identity..." -ForegroundColor Cyan

if (-not (WaitUrl "http://127.0.0.1:3000/api/health/live" 8)) {
  throw "iRec API no esta disponible en http://127.0.0.1:3000. Inicia el backend antes del smoke frontend."
}

$webUrl = "http://127.0.0.1:4200"
$reuseExisting = $false
$p = $null

if (WaitUrl "$webUrl/" 2) {
  Write-Host "[INFO] Reutilizando servidor iRec web existente en $webUrl" -ForegroundColor Yellow
  $reuseExisting = $true
} else {
  $owner = GetPortOwner 4200

  if ($owner) {
    $process = Get-Process -Id $owner.OwningProcess -ErrorAction SilentlyContinue
    $name = if ($process) { $process.ProcessName } else { "desconocido" }

    throw "El puerto 4200 esta ocupado por PID $($owner.OwningProcess) ($name), pero no responde en 127.0.0.1. Libera ese proceso antes de ejecutar el gate."
  }

  $tmp = Join-Path $RepoRoot ".tmp"
  New-Item -ItemType Directory -Force $tmp | Out-Null

  $out = Join-Path $tmp "identity-web.out.log"
  $err = Join-Path $tmp "identity-web.err.log"
  Remove-Item $out,$err -Force -ErrorAction SilentlyContinue

  Write-Host "Iniciando iRec web en 127.0.0.1:4200..." -ForegroundColor Cyan

  $p = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList "/d","/s","/c","pnpm --filter @irec/web dev" `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput $out `
    -RedirectStandardError $err `
    -PassThru
}

$urls = @(
  "$webUrl/",
  "$webUrl/auth",
  "$webUrl/auth/recover",
  "$webUrl/settings/security",
  "$webUrl/api/health/live"
)

$ok = $true

foreach ($url in $urls) {
  if (-not (WaitUrl $url $TimeoutSeconds)) {
    Write-Host "[FAIL] $url" -ForegroundColor Red
    $ok = $false
  } else {
    Write-Host "[OK]   $url" -ForegroundColor Green
  }
}

if (-not $ok) {
  if (-not $reuseExisting) {
    Write-Host ""
    Write-Host "--- web stdout ---"
    Get-Content $out -Tail 100 -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "--- web stderr ---"
    Get-Content $err -Tail 100 -ErrorAction SilentlyContinue

    if ($p -and -not $p.HasExited) {
      taskkill /PID $p.Id /T /F | Out-Null
    }
  }

  throw "Identity frontend smoke test fallo."
}

Write-Host ""
Write-Host "iRec v0.2.0 IDENTITY FRONTEND PASSED" -ForegroundColor Green
Write-Host "Web: $webUrl"
Write-Host "API proxy: /api -> http://127.0.0.1:3000"

if ($reuseExisting) {
  Write-Host "Servidor web reutilizado; el gate no inicio un proceso nuevo."
} else {
  Write-Host "La PWA queda ejecutandose. PID launcher: $($p.Id)"
}
