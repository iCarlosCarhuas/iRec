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

Write-Host '=== iRec R2-4 Presigned Upload Source Gate ===' -ForegroundColor Cyan
Write-Host "Repository: $RepoRoot"

$api = Read-Json 'apps/api/package.json'
$assetContracts = Read-Text 'packages/contracts/src/asset.ts'
$albumContracts = Read-Text 'packages/contracts/src/album.ts'
$uploadService = Read-Text 'apps/api/src/albums/album-asset-upload.service.ts'
$intentService = Read-Text 'apps/api/src/albums/album-asset-upload-intent.service.ts'
$assetService = Read-Text 'apps/api/src/albums/album-assets.service.ts'
$controller = Read-Text 'apps/api/src/albums/album-assets.controller.ts'
$r2Objects = Read-Text 'apps/api/src/storage/r2-object.service.ts'
$openapi = Read-Text 'apps/api/src/openapi/document.ts'
$storageModule = Read-Text 'apps/api/src/storage/storage.module.ts'
$albumModule = Read-Text 'apps/api/src/albums/album.module.ts'

Assert-True ($api.dependencies.'@aws-sdk/client-s3' -eq '3.1135.0') 'S3 client remains pinned'
Assert-True ($api.dependencies.'@aws-sdk/s3-request-presigner' -eq '3.1135.0') 'S3 presigner is pinned to the same SDK version'

Assert-True ($assetContracts -match 'PresignAlbumAssetInput') 'presign input contract exists'
Assert-True ($assetContracts -match 'CompleteAlbumAssetUploadInput') 'completion contract exists'
Assert-True ($assetContracts -match 'image/jpeg') 'JPEG upload is explicitly allowed'
Assert-True ($assetContracts -match 'image/png') 'PNG upload is explicitly allowed'
Assert-True ($assetContracts -match 'image/webp') 'WebP upload is explicitly allowed'
Assert-True ($albumContracts -match 'SetAlbumStorageConnectionInput') 'album storage binding contract exists'

Assert-True ($uploadService -match 'randomUUID') 'asset id is reserved server-side'
Assert-True ($uploadService -match 'HeadObject|headObject') 'completion validates the R2 object'
Assert-True ($uploadService -match 'registerUploaded') 'completion crosses the R2-3 registration boundary'
Assert-True ($intentService -match 'irec:photo-upload:') 'upload intent uses a dedicated Redis namespace'
Assert-True ($intentService -match 'hashOpaque') 'raw upload token is not exposed in Redis keys'
Assert-True ($r2Objects -match 'PutObjectCommand') 'presigned PUT uses PutObjectCommand'
Assert-True ($r2Objects -match 'ContentType') 'Content-Type is signed into the PUT authorization'
Assert-True ($r2Objects -match 'HeadObjectCommand') 'R2 completion uses HeadObject'
Assert-True ($controller -match "Post\('presign'\)") 'presign endpoint exists'
Assert-True ($controller -match "Post\(':assetId/complete'\)") 'completion endpoint exists'
Assert-True ($storageModule -match 'R2ObjectService') 'R2ObjectService is registered and exported'
Assert-True ($albumModule -match 'StorageModule') 'AlbumModule imports StorageModule'
Assert-True ($assetService -match 'storageConnectionId: input.storageConnectionId') 'registered asset uses the frozen storage connection'
Assert-True ($assetService -match 'id: input.assetId') 'reserved asset id becomes the PostgreSQL id'

Assert-True ($openapi -match "'/albums/\{albumId\}/storage'") 'OpenAPI includes album storage binding'
Assert-True ($openapi -match "'/albums/\{albumId\}/assets/presign'") 'OpenAPI includes presign'
Assert-True ($openapi -match "'/albums/\{albumId\}/assets/\{assetId\}/complete'") 'OpenAPI includes completion'

$migration4 = @(Get-ChildItem (Join-Path $RepoRoot 'apps/api/drizzle') -Filter '0004_*.sql' -ErrorAction SilentlyContinue)
$migration5 = @(Get-ChildItem (Join-Path $RepoRoot 'apps/api/drizzle') -Filter '0005_*.sql' -ErrorAction SilentlyContinue)
Assert-True ($migration4.Count -eq 1) 'exactly one migration 0004 remains present'
Assert-True ($migration5.Count -eq 0) 'R2-4 introduces no migration 0005'

$migrationSql = Get-Content $migration4[0].FullName -Raw
Assert-True ($migrationSql -notmatch 'restrictON') 'migration 0004 keeps valid FK spacing'

$changedEnv = (& git -C $RepoRoot status --short --untracked-files=all | Select-String -Pattern '(^|/)\.env(\.|$)' -CaseSensitive)
Assert-True (-not $changedEnv) 'no real env files are added or modified'

$trackedTsbuild = (& git -C $RepoRoot ls-files '*.tsbuildinfo')
Assert-True (-not $trackedTsbuild) 'no tsbuildinfo files are tracked'

Write-Host ''
Write-Host 'R2-4 PRESIGNED UPLOAD SOURCE GATE PASSED' -ForegroundColor Green
