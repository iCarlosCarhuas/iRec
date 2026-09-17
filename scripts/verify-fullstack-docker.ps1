$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $RepoRoot
try {
  Write-Host '== iRec v0.2.0 Full-stack Docker Gate ==' -ForegroundColor Cyan

  & powershell.exe -ExecutionPolicy Bypass -File .\scripts\irec.ps1 doctor
  if ($LASTEXITCODE -ne 0) { throw 'Doctor fallo.' }

  & powershell.exe -ExecutionPolicy Bypass -File .\scripts\irec.ps1 up
  if ($LASTEXITCODE -ne 0) { throw 'Full-stack up fallo.' }

  $checks = @(
    'http://127.0.0.1:4200/',
    'http://127.0.0.1:3000/api/health/live',
    'http://127.0.0.1:3000/api/health/ready',
    'http://127.0.0.1:3000/openapi.json',
    'http://127.0.0.1:3000/reference',
    'http://127.0.0.1:8025/'
  )

  foreach ($url in $checks) {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 10
    if ($r.StatusCode -lt 200 -or $r.StatusCode -ge 400) {
      throw "HTTP gate fallo: $url -> $($r.StatusCode)"
    }
    Write-Host "[OK] $url" -ForegroundColor Green
  }

  $migrationState = ((& docker inspect -f '{{.State.ExitCode}}' irec-migrate 2>$null | Out-String).Trim())
  if ($migrationState -ne '0') {
    throw "irec-migrate no termino con exit 0. ExitCode=$migrationState"
  }
  Write-Host '[OK] irec-migrate exit 0' -ForegroundColor Green

  Write-Host ''
  Write-Host 'iRec v0.2.0 FULL-STACK DOCKER PASSED' -ForegroundColor Green
} finally {
  Pop-Location
}
