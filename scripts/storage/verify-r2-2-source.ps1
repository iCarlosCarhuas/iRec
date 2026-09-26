param()

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw "[FAIL] $Message" }
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Read-Json {
  param([string]$RelativePath)
  return Get-Content (Join-Path $RepoRoot $RelativePath) -Raw | ConvertFrom-Json
}

function Read-Text {
  param([string]$RelativePath)
  return Get-Content (Join-Path $RepoRoot $RelativePath) -Raw
}

Write-Host '=== iRec R2-2 R2 Verification Source Gate ===' -ForegroundColor Cyan
Write-Host "Repository: $RepoRoot"

$root = Read-Json 'package.json'
$api = Read-Json 'apps/api/package.json'
$web = Read-Json 'apps/web/package.json'
$contracts = Read-Json 'packages/contracts/package.json'

Assert-True ($root.version -eq '0.3.0') 'root package remains 0.3.0'
Assert-True ($api.version -eq '0.3.0') '@irec/api remains 0.3.0'
Assert-True ($web.version -eq '0.3.0') '@irec/web remains 0.3.0'
Assert-True ($contracts.version -eq '0.3.0') '@irec/contracts remains 0.3.0'

Assert-True (Test-Path (Join-Path $RepoRoot 'apps/api/src/storage/storage.controller.ts')) 'storage controller exists'
Assert-True (Test-Path (Join-Path $RepoRoot 'apps/api/src/storage/r2-verifier.service.ts')) 'R2 verifier exists'
Assert-True (Test-Path (Join-Path $RepoRoot 'apps/api/test/storage.r2.test.ts')) 'R2 tests exist'

$apiPackage = Read-Text 'apps/api/package.json'
$module = Read-Text 'apps/api/src/storage/storage.module.ts'
$controller = Read-Text 'apps/api/src/storage/storage.controller.ts'
$verifier = Read-Text 'apps/api/src/storage/r2-verifier.service.ts'
$service = Read-Text 'apps/api/src/storage/storage.service.ts'
$storageContract = Read-Text 'packages/contracts/src/storage.ts'
$openapi = Read-Text 'apps/api/src/openapi/document.ts'
$schema = Read-Text 'apps/api/src/database/schema.ts'

Assert-True ($apiPackage -match '@aws-sdk/client-s3') 'AWS S3 client dependency is introduced in R2-2'
Assert-True ($verifier -match 'HeadBucketCommand') 'R2 verification uses HeadBucket'
Assert-True ($verifier -match "region:\s*'auto'") 'R2 client uses region auto'
Assert-True ($verifier -match 'r2\.cloudflarestorage\.com') 'R2 endpoint is Cloudflare account endpoint'
Assert-True ($verifier -match 'AbortController') 'R2 verification has a timeout boundary'
Assert-True ($module -match 'StorageController') 'StorageController is registered'
Assert-True ($module -match 'R2VerifierService') 'R2VerifierService is registered'
Assert-True ($controller -match "@Controller\('storage-connections'\)") 'storage-connections controller path is registered'
Assert-True ($controller -match "Post\(':connectionId/test'\)") 'connection re-test endpoint exists'
Assert-True ($controller -match 'RateLimitService') 'R2 verification endpoints are rate limited'
Assert-True ($service -match 'persistVerified') 'create flow keeps verified-only persistence boundary'
Assert-True ($service -match 'markVerified') 're-test updates lastVerifiedAt'
Assert-True ($storageContract -match '\^\[0-9a-f\]\{32\}\$') 'Cloudflare Account ID is constrained before endpoint construction'
Assert-True ($openapi -match "'/storage-connections'") 'OpenAPI includes storage-connections'
Assert-True ($openapi -match "'/storage-connections/\{connectionId\}/test'") 'OpenAPI includes connection test endpoint'
Assert-True ($schema -notmatch 'album_assets') 'album_assets is not introduced during R2-2'

$migration4 = @(Get-ChildItem (Join-Path $RepoRoot 'apps/api/drizzle') -Filter '0004_*.sql' -ErrorAction SilentlyContinue)
Assert-True ($migration4.Count -eq 0) 'R2-2 does not introduce migration 0004'

$changedEnv = (& git -C $RepoRoot status --short --untracked-files=all | Select-String -Pattern '(^|/)\.env(\.|$)' -CaseSensitive)
Assert-True (-not $changedEnv) 'no real env files are added or modified'

$trackedTsbuild = (& git -C $RepoRoot ls-files '*.tsbuildinfo')
Assert-True (-not $trackedTsbuild) 'no tsbuildinfo files are tracked'

Write-Host ''
Write-Host 'R2-2 R2 VERIFICATION SOURCE GATE PASSED' -ForegroundColor Green
