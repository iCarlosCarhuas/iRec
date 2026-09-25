$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repoRoot

$failures = [System.Collections.Generic.List[string]]::new()

function Pass([string]$message) {
  Write-Host "[OK] $message" -ForegroundColor Green
}

function Fail([string]$message) {
  Write-Host "[FAIL] $message" -ForegroundColor Red
  $failures.Add($message)
}

function Assert-True([bool]$condition, [string]$message) {
  if ($condition) { Pass $message } else { Fail $message }
}

function Read-Json([string]$relativePath) {
  return Get-Content (Join-Path $repoRoot $relativePath) -Raw | ConvertFrom-Json
}

Write-Host '=== iRec R2-0 Foundation Gate ===' -ForegroundColor Cyan
Write-Host "Repository: $repoRoot"

$rootPackage = Read-Json 'package.json'
$apiPackage = Read-Json 'apps/api/package.json'
$webPackage = Read-Json 'apps/web/package.json'
$contractsPackage = Read-Json 'packages/contracts/package.json'

Assert-True ($rootPackage.version -eq '0.3.0') 'root package remains 0.3.0'
Assert-True ($apiPackage.version -eq '0.3.0') '@irec/api remains 0.3.0'
Assert-True ($webPackage.version -eq '0.3.0') '@irec/web remains 0.3.0'
Assert-True ($contractsPackage.version -eq '0.3.0') '@irec/contracts remains 0.3.0'

$projectState = Get-Content (Join-Path $repoRoot 'docs/PROJECT-STATE.md') -Raw
$projectManifest = Get-Content (Join-Path $repoRoot 'PROJECT_MANIFEST.md') -Raw
$rootManifest = Read-Json 'manifest.json'
$docsManifest = Read-Json 'docs/manifest.json'

Assert-True ($projectState -match 'v0\.3\.0.+Album Core') 'PROJECT-STATE identifies v0.3.0 Album Core as stable'
Assert-True ($projectState -match 'v0\.4\.0.+R2 \+ Photos') 'PROJECT-STATE identifies v0.4.0 R2 + Photos as target'
Assert-True ($projectManifest -match 'Stable release: `v0\.3\.0') 'PROJECT_MANIFEST identifies v0.3.0 as stable'
Assert-True ($projectManifest -match 'Working release: `v0\.4\.0') 'PROJECT_MANIFEST identifies v0.4.0 as working release'
Assert-True ($rootManifest.stable_version -eq 'v0.3.0') 'root manifest stable_version is v0.3.0'
Assert-True ($rootManifest.working_version -eq 'v0.4.0') 'root manifest working_version is v0.4.0'
Assert-True ($docsManifest.stable_version -eq 'v0.3.0') 'docs manifest stable_version is v0.3.0'
Assert-True ($docsManifest.working_version -eq 'v0.4.0') 'docs manifest working_version is v0.4.0'

Assert-True (Test-Path (Join-Path $repoRoot 'docs/TECH/ADR/ADR-0003-r2.md')) 'ADR-0003 BYO R2 still exists'
Assert-True (Test-Path (Join-Path $repoRoot 'docs/TECH/ADR/ADR-0013-r2-photo-lifecycle.md')) 'ADR-0013 R2 photo lifecycle exists'

$apiDependencyNames = @()
if ($apiPackage.dependencies) {
  $apiDependencyNames += $apiPackage.dependencies.PSObject.Properties.Name
}
if ($apiPackage.devDependencies) {
  $apiDependencyNames += $apiPackage.devDependencies.PSObject.Properties.Name
}

$hasAwsSdk = @($apiDependencyNames | Where-Object { $_ -like '@aws-sdk/*' }).Count -gt 0
Assert-True (-not $hasAwsSdk) 'AWS SDK is not introduced during R2-0'

$schema = Get-Content (Join-Path $repoRoot 'apps/api/src/database/schema.ts') -Raw
Assert-True ($schema -notmatch 'storage_connections') 'storage_connections table is not introduced during R2-0'
Assert-True ($schema -notmatch 'album_assets') 'album_assets table is not introduced during R2-0'

$statusLines = @(git status --porcelain --untracked-files=all)
$changedEnvFiles = @(
  $statusLines | Where-Object {
    $path = if ($_.Length -gt 3) { $_.Substring(3).Trim() } else { '' }
    $path -match '(^|/)\.env($|\.)'
  }
)
Assert-True ($changedEnvFiles.Count -eq 0) 'no .env/.env.* files were added or modified in R2-0'

$trackedBuildInfo = @(git ls-files '*.tsbuildinfo')
Assert-True ($trackedBuildInfo.Count -eq 0) 'no tsbuildinfo files are tracked'

$adrIndex = Get-Content (Join-Path $repoRoot 'docs/TECH/ADR/README.md') -Raw
Assert-True ($adrIndex -match '0013') 'ADR index includes ADR-0013'

if ($failures.Count -gt 0) {
  Write-Host ''
  Write-Host "R2-0 FOUNDATION GATE FAILED ($($failures.Count) failure(s))" -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host 'R2-0 FOUNDATION GATE PASSED' -ForegroundColor Green
exit 0
