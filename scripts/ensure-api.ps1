param(
  [switch]$StartIfMissing,
  [int]$TimeoutSeconds = 20
)

$ErrorActionPreference = "Stop"

function Test-Api {
  try {
    $r = Invoke-RestMethod `
      -Uri "http://127.0.0.1:3000/api/health/live" `
      -TimeoutSec 3

    return ($r.status -eq "ok" -and $r.service -eq "irec-api")
  }
  catch {
    return $false
  }
}

if (Test-Api) {
  Write-Host "[OK] irec-api ya esta ejecutandose en http://127.0.0.1:3000" -ForegroundColor Green
  exit 0
}

$owner = Get-NetTCPConnection `
  -LocalPort 3000 `
  -State Listen `
  -ErrorAction SilentlyContinue |
  Select-Object -First 1

if ($owner) {
  $process = Get-Process -Id $owner.OwningProcess -ErrorAction SilentlyContinue
  $name = if ($process) { $process.ProcessName } else { "desconocido" }

  throw "El puerto 3000 esta ocupado por PID $($owner.OwningProcess) ($name), pero no responde como irec-api."
}

if (-not $StartIfMissing) {
  Write-Host "[INFO] irec-api no esta ejecutandose." -ForegroundColor Yellow
  Write-Host "Inicia con:"
  Write-Host "  pnpm dev:api"
  exit 1
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

Write-Host "Iniciando irec-api..." -ForegroundColor Cyan

$p = Start-Process `
  -FilePath "cmd.exe" `
  -ArgumentList "/d","/s","/c","pnpm dev:api" `
  -WorkingDirectory $RepoRoot `
  -PassThru

$end = (Get-Date).AddSeconds($TimeoutSeconds)

while ((Get-Date) -lt $end) {
  if (Test-Api) {
    Write-Host "[OK] irec-api iniciado. PID launcher: $($p.Id)" -ForegroundColor Green
    exit 0
  }

  Start-Sleep -Seconds 1
}

throw "irec-api no quedo disponible dentro de $TimeoutSeconds segundos."
