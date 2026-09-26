$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$failures = New-Object System.Collections.Generic.List[string]

function Ok([string]$message) {
  Write-Host "[OK] $message" -ForegroundColor Green
}

function Fail([string]$message) {
  $script:failures.Add($message)
  Write-Host "[FAIL] $message" -ForegroundColor Red
}

function Assert-True([bool]$condition, [string]$message) {
  if ($condition) { Ok $message } else { Fail $message }
}

function Read-Json([string]$relativePath) {
  return Get-Content (Join-Path $repoRoot $relativePath) -Raw | ConvertFrom-Json
}

Write-Host '=== iRec R2-1 Storage Domain Source Gate ===' -ForegroundColor Cyan
Write-Host "Repository: $repoRoot"

$rootPackage = Read-Json 'package.json'
$apiPackage = Read-Json 'apps/api/package.json'
$webPackage = Read-Json 'apps/web/package.json'
$contractsPackage = Read-Json 'packages/contracts/package.json'

Assert-True ($rootPackage.version -eq '0.3.0') 'root package remains 0.3.0'
Assert-True ($apiPackage.version -eq '0.3.0') '@irec/api remains 0.3.0'
Assert-True ($webPackage.version -eq '0.3.0') '@irec/web remains 0.3.0'
Assert-True ($contractsPackage.version -eq '0.3.0') '@irec/contracts remains 0.3.0'

$expectedFiles = @(
  'packages/contracts/src/storage.ts',
  'apps/api/src/storage/storage.module.ts',
  'apps/api/src/storage/storage.service.ts',
  'apps/api/src/storage/storage.policy.ts',
  'apps/api/test/storage.domain.test.ts'
)
foreach ($relativePath in $expectedFiles) {
  Assert-True (Test-Path (Join-Path $repoRoot $relativePath)) "$relativePath exists"
}

$contractsIndex = Get-Content (Join-Path $repoRoot 'packages/contracts/src/index.ts') -Raw
Assert-True ($contractsIndex -match "storage\.js") 'storage contracts are exported'

$schema = Get-Content (Join-Path $repoRoot 'apps/api/src/database/schema.ts') -Raw
Assert-True ($schema -match 'storage_connections') 'storage_connections exists in source schema'
Assert-True ($schema -match 'access_key_id_encrypted') 'Access Key ID is stored encrypted'
Assert-True ($schema -match 'secret_access_key_encrypted') 'Secret Access Key is stored encrypted'
Assert-True ($schema -match 'storage_connection_id') 'albums has nullable storage_connection_id source field'
Assert-True ($schema -match "onDelete: 'set null'") 'album storage FK is non-destructive on connection delete'
Assert-True ($schema -notmatch 'album_assets') 'album_assets is not introduced during R2-1'

$storageService = Get-Content (Join-Path $repoRoot 'apps/api/src/storage/storage.service.ts') -Raw
Assert-True ($storageService -match 'CryptoService') 'StorageConnection service reuses CryptoService'
Assert-True ($storageService -match 'persistVerified') 'persistence boundary is explicitly verified-only'
Assert-True ($storageService -notmatch '@aws-sdk/') 'StorageConnection service has no AWS SDK dependency'

$appModule = Get-Content (Join-Path $repoRoot 'apps/api/src/app.module.ts') -Raw
Assert-True ($appModule -match 'StorageModule') 'StorageModule is registered in AppModule'

$apiDependencyNames = @($apiPackage.dependencies.PSObject.Properties.Name)
$hasAwsSdk = @($apiDependencyNames | Where-Object { $_ -like '@aws-sdk/*' }).Count -gt 0
Assert-True (-not $hasAwsSdk) 'AWS SDK is not introduced during R2-1'

$status = git -C $repoRoot status --porcelain -- '.env' '.env.local' '.env.docker'
Assert-True ([string]::IsNullOrWhiteSpace(($status -join ''))) 'no real env files are added or modified'

$trackedBuildInfo = git -C $repoRoot ls-files '*.tsbuildinfo'
Assert-True ([string]::IsNullOrWhiteSpace(($trackedBuildInfo -join ''))) 'no tsbuildinfo files are tracked'

if ($failures.Count -gt 0) {
  Write-Host "R2-1 SOURCE GATE FAILED ($($failures.Count) failure(s))" -ForegroundColor Red
  foreach ($failure in $failures) { Write-Host " - $failure" -ForegroundColor Red }
  exit 1
}

Write-Host ''
Write-Host 'R2-1 STORAGE DOMAIN SOURCE GATE PASSED' -ForegroundColor Green
