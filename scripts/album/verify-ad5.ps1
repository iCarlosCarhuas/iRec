Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Push-Location $RepoRoot

try {
    Write-Host "iRec v0.3.0 - AD-5 Album UI Source Gate"
    Write-Host "-----------------------------------------"

    $requiredFiles = @(
        "apps/web/src/app/features/albums/album-api.service.ts",
        "apps/web/src/app/features/albums/albums.page.ts",
        "apps/web/src/app/features/albums/album-detail.page.ts",
        "apps/web/src/app/features/albums/album-join.page.ts",
        "docs/FRONTEND/ALBUM-UI.md"
    )

    foreach ($file in $requiredFiles) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
            throw "Falta archivo AD-5: $file"
        }
    }

    $routes = Get-Content "apps/web/src/app/app.routes.ts" -Raw
    foreach ($required in @(
        "path: 'albums'",
        "path: 'albums/:albumId/join'",
        "path: 'albums/:albumId'",
        "canActivate: [authGuard]"
    )) {
        if ($routes -notmatch [regex]::Escape($required)) {
            throw "Routing AD-5 incompleto: $required"
        }
    }

    $api = Get-Content "apps/web/src/app/features/albums/album-api.service.ts" -Raw
    foreach ($required in @(
        "/members/invite",
        "/members/accept",
        "/proposals",
        "/approve",
        "/reject",
        "withCredentials: true"
    )) {
        if ($api -notmatch [regex]::Escape($required)) {
            throw "AlbumApiService AD-5 incompleto: $required"
        }
    }

    $migrationDiff = & git status --short -- "apps/api/drizzle" "apps/api/src/database/schema.ts"
    if ($migrationDiff) {
        throw "AD-5 no debe modificar schema ni migraciones:`n$migrationDiff"
    }
    Write-Host "[OK] Sin cambios de schema/migraciones."

    & pnpm --filter @irec/contracts build
    if ($LASTEXITCODE -ne 0) { throw "Contracts build fallo." }
    Write-Host "[OK] Contracts build."

    & pnpm --filter @irec/web typecheck
    if ($LASTEXITCODE -ne 0) { throw "Web typecheck fallo." }
    Write-Host "[OK] Web typecheck."

    & pnpm --filter @irec/web build
    if ($LASTEXITCODE -ne 0) { throw "Web build fallo." }
    Write-Host "[OK] Web production build."

    Write-Host ""
    Write-Host "[OK] iRec v0.3.0 AD-5 SOURCE GATE PASSED"
    Write-Host "[NEXT] Runtime gate con irec-api + irec-web; no se requiere migracion."
}
finally {
    Pop-Location
}
