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

Write-Host '=== iRec R2-3 Photo Domain Source Gate ===' -ForegroundColor Cyan
Write-Host "Repository: $RepoRoot"

$root = Read-Json 'package.json'
$api = Read-Json 'apps/api/package.json'
$web = Read-Json 'apps/web/package.json'
$contracts = Read-Json 'packages/contracts/package.json'

Assert-True ($root.version -eq '0.3.0') 'root package remains 0.3.0'
Assert-True ($api.version -eq '0.3.0') '@irec/api remains 0.3.0'
Assert-True ($web.version -eq '0.3.0') '@irec/web remains 0.3.0'
Assert-True ($contracts.version -eq '0.3.0') '@irec/contracts remains 0.3.0'

Assert-True (Test-Path (Join-Path $RepoRoot 'packages/contracts/src/asset.ts')) 'asset contracts exist'
Assert-True (Test-Path (Join-Path $RepoRoot 'apps/api/src/albums/album-assets.policy.ts')) 'asset policy exists'
Assert-True (Test-Path (Join-Path $RepoRoot 'apps/api/src/albums/album-assets.service.ts')) 'asset service exists'
Assert-True (Test-Path (Join-Path $RepoRoot 'apps/api/src/albums/album-assets.controller.ts')) 'asset controller exists'
Assert-True (Test-Path (Join-Path $RepoRoot 'apps/api/test/album-asset.policy.test.ts')) 'asset policy tests exist'

$schema = Read-Text 'apps/api/src/database/schema.ts'
$service = Read-Text 'apps/api/src/albums/album-assets.service.ts'
$controller = Read-Text 'apps/api/src/albums/album-assets.controller.ts'
$module = Read-Text 'apps/api/src/albums/album.module.ts'
$contractsIndex = Read-Text 'packages/contracts/src/index.ts'
$openapi = Read-Text 'apps/api/src/openapi/document.ts'

Assert-True ($schema -match "album_asset_status") 'album_asset_status enum exists in source schema'
Assert-True ($schema -match "'album_assets'") 'album_assets exists in source schema'
Assert-True ($schema -match "thumbnail_object_key") 'thumbnail object key is nullable metadata'
Assert-True ($schema -match "uploaded_at") 'uploaded_at exists'
Assert-True ($schema -match "onDelete:\s*'restrict'") 'asset references use explicit restrict policies'
Assert-True ($schema -match "album_assets_storage_object_uq") 'object key uniqueness exists per storage connection'
Assert-True ($service -match 'registerUploaded') 'asset registration is an internal upload-completion boundary'
Assert-True ($service -match 'requireAlbumStorage') 'asset registration validates album storage ownership'
Assert-True ($controller -notmatch '@Post\(\)') 'R2-3 does not expose a public asset-create endpoint'
Assert-True ($controller -match "Post\(':assetId/approve'\)") 'asset approve endpoint exists'
Assert-True ($controller -match "Post\(':assetId/reject'\)") 'asset reject endpoint exists'
Assert-True ($module -match 'AlbumAssetsController') 'AlbumAssetsController is registered'
Assert-True ($module -match 'AlbumAssetsService') 'AlbumAssetsService is registered'
Assert-True ($contractsIndex -match "asset\.js") 'asset contracts are exported'
Assert-True ($openapi -match "'/albums/\{albumId\}/assets'") 'OpenAPI includes asset listing'
Assert-True ($openapi -match "'/albums/\{albumId\}/assets/\{assetId\}/approve'") 'OpenAPI includes asset approve'
Assert-True ($openapi -match "'/albums/\{albumId\}/assets/\{assetId\}/reject'") 'OpenAPI includes asset reject'

Assert-True ($service -notmatch 'PutObjectCommand|CreateMultipartUploadCommand|UploadPartCommand') 'R2-3 does not upload bytes'
Assert-True ($service -notmatch 'getSignedUrl|presign') 'R2-3 does not presign uploads'

$migration4 = @(Get-ChildItem (Join-Path $RepoRoot 'apps/api/drizzle') -Filter '0004_*.sql' -ErrorAction SilentlyContinue)
Assert-True ($migration4.Count -eq 1) 'exactly one migration 0004 is present'

$migrationSql = Get-Content $migration4[0].FullName -Raw
Assert-True ($migrationSql -notmatch 'restrictON') 'migration 0004 has valid FK spacing'
Assert-True ($migrationSql -notmatch '(?i)\bDROP\s|\bTRUNCATE\s|\bDELETE\s+FROM\b') 'migration 0004 contains no destructive SQL'


$changedEnv = (& git -C $RepoRoot status --short --untracked-files=all | Select-String -Pattern '(^|/)\.env(\.|$)' -CaseSensitive)
Assert-True (-not $changedEnv) 'no real env files are added or modified'

$trackedTsbuild = (& git -C $RepoRoot ls-files '*.tsbuildinfo')
Assert-True (-not $trackedTsbuild) 'no tsbuildinfo files are tracked'

Write-Host ''
Write-Host 'R2-3 PHOTO DOMAIN SOURCE GATE PASSED' -ForegroundColor Green
