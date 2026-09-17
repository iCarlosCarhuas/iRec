Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Push-Location $RepoRoot

try {
    Write-Host "iRec v0.3.0 - AD-3 Membership & Permissions Gate"
    Write-Host "-------------------------------------------------"

    $requiredFiles = @(
        "apps/api/src/albums/album-members.controller.ts",
        "apps/api/src/albums/album-members.service.ts",
        "apps/api/src/albums/album.policy.ts",
        "apps/api/test/album.policy.test.ts"
    )

    foreach ($file in $requiredFiles) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
            throw "Falta archivo AD-3: $file"
        }
    }

    $controller = Get-Content "apps/api/src/albums/album-members.controller.ts" -Raw
    foreach ($required in @(
        "@Get()",
        "@Post('invite')",
        "@Post('accept')",
        "@Delete(':userId')",
        "irec_access"
    )) {
        if ($controller -notmatch [regex]::Escape($required)) {
            throw "Falta en AlbumMembersController: $required"
        }
    }

    $service = Get-Content "apps/api/src/albums/album-members.service.ts" -Raw
    foreach ($required in @(
        "status: 'invited'",
        "status: 'active'",
        "status: 'removed'",
        "canManageAlbumMembers",
        "canViewAlbumMembers"
    )) {
        if ($service -notmatch [regex]::Escape($required)) {
            throw "Falta en AlbumMembersService: $required"
        }
    }

    Write-Host "[OK] Estructura AD-3 presente."

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

    $migrationDiff = & git diff --name-only -- "apps/api/drizzle"
    if ($migrationDiff) {
        Write-Warning "Hay cambios en apps/api/drizzle. AD-3 no requiere migracion; revisalos antes de continuar."
    } else {
        Write-Host "[OK] AD-3 no agrega migraciones de DB."
    }

    Write-Host ""
    Write-Host "[OK] iRec v0.3.0 AD-3 SOURCE GATE PASSED"
}
finally {
    Pop-Location
}
