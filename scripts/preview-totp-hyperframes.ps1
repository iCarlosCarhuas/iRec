$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Project = Join-Path $RepoRoot "apps\web\public\tutorials\totp-onboarding"

if (-not (Test-Path $Project)) {
  throw "No existe el proyecto HyperFrames TOTP: $Project"
}

Push-Location $Project
try {
  Write-Host "== iRec TOTP HyperFrames ==" -ForegroundColor Cyan
  Write-Host "Lint..." -ForegroundColor Cyan
  & npx hyperframes lint
  if ($LASTEXITCODE -ne 0) { throw "HyperFrames lint fallo." }

  Write-Host "Check..." -ForegroundColor Cyan
  & npx hyperframes check
  if ($LASTEXITCODE -ne 0) { throw "HyperFrames check fallo." }

  Write-Host "Preview..." -ForegroundColor Cyan
  & npx hyperframes preview
}
finally {
  Pop-Location
}
