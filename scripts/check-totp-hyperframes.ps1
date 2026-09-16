$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Project = Join-Path $RepoRoot "apps\web\public\tutorials\totp-onboarding"

if (-not (Test-Path $Project)) {
  throw "No existe el proyecto HyperFrames TOTP: $Project"
}

Push-Location $Project
try {
  Write-Host "== iRec TOTP HyperFrames QA ==" -ForegroundColor Cyan

  Write-Host ""
  Write-Host "1. Lint" -ForegroundColor Cyan
  & npx hyperframes lint
  if ($LASTEXITCODE -ne 0) {
    throw "HyperFrames lint fallo."
  }

  Write-Host ""
  Write-Host "2. Check" -ForegroundColor Cyan
  & npx hyperframes check
  if ($LASTEXITCODE -ne 0) {
    throw "HyperFrames check fallo."
  }

  Write-Host ""
  Write-Host "[OK] iRec TOTP HyperFrames QA PASSED" -ForegroundColor Green
  Write-Host "Nota: timeline_track_too_dense es una advertencia de mantenibilidad, no un error de render."
}
finally {
  Pop-Location
}
