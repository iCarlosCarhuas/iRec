Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Push-Location $RepoRoot

try {
    Write-Host "iRec v0.3.0 - AD-2 Album API Gate"
    Write-Host "--------------------------------"

    $requiredFiles = @(
        "apps/api/src/albums/album.module.ts",
        "apps/api/src/albums/album.controller.ts",
        "apps/api/src/albums/album.service.ts",
        "apps/api/src/albums/album.policy.ts",
        "apps/api/test/album.policy.test.ts"
    )

    foreach ($file in $requiredFiles) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
            throw "Falta archivo AD-2: $file"
        }
    }

    $controller = Get-Content "apps/api/src/albums/album.controller.ts" -Raw
    foreach ($required in @(
        "@Post()",
        "@Get()",
        "@Get(':albumId')",
        "@Patch(':albumId')",
        "irec_access"
    )) {
        if ($controller -notmatch [regex]::Escape($required)) {
            throw "Falta en AlbumController: $required"
        }
    }

    $service = Get-Content "apps/api/src/albums/album.service.ts" -Raw
    foreach ($required in @(
        ".transaction(",
        "role: 'owner'",
        "status: 'active'",
        "canReadAlbum",
        "canUpdateAlbum"
    )) {
        if ($service -notmatch [regex]::Escape($required)) {
            throw "Falta en AlbumService: $required"
        }
    }

    Write-Host "[OK] Estructura AD-2 presente."

    & pnpm --filter @irec/contracts build
    if ($LASTEXITCODE -ne 0) { throw "Contracts build fallo." }
    Write-Host "[OK] Contracts build."

    & pnpm --filter @irec/api typecheck
    if ($LASTEXITCODE -ne 0) { throw "API typecheck fallo." }
    Write-Host "[OK] API typecheck."

    & pnpm --filter @irec/api test:album
    if ($LASTEXITCODE -ne 0) { throw "Album tests fallaron." }
    Write-Host "[OK] Album policy/contracts tests."

    & pnpm --filter @irec/api openapi:check
    if ($LASTEXITCODE -ne 0) { throw "OpenAPI check fallo." }
    Write-Host "[OK] OpenAPI check."

    $schemaDiff = & git diff --name-only -- "apps/api/drizzle"
    if ($schemaDiff) {
        Write-Warning "Hay cambios en apps/api/drizzle. AD-2 no requiere migracion; revisalos antes de continuar."
    } else {
        Write-Host "[OK] AD-2 no agrega migraciones de DB."
    }

    Write-Host ""
    Write-Host "[OK] iRec v0.3.0 AD-2 SOURCE GATE PASSED"
}
finally {
    Pop-Location
}
