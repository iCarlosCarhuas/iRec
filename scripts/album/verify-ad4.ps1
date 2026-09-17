Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Push-Location $RepoRoot

try {
    Write-Host "iRec v0.3.0 - AD-4 Proposals & Moderation Source Gate"
    Write-Host "------------------------------------------------------"

    $requiredFiles = @(
        "apps/api/src/albums/album-proposals.controller.ts",
        "apps/api/src/albums/album-proposals.service.ts",
        "docs/API/ALBUM-PROPOSALS.md"
    )

    foreach ($file in $requiredFiles) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
            throw "Falta archivo AD-4: $file"
        }
    }

    $schema = Get-Content "apps/api/src/database/schema.ts" -Raw
    foreach ($required in @(
        "album_proposal_status",
        "album_proposals",
        "pending",
        "approved",
        "rejected"
    )) {
        if ($schema -notmatch [regex]::Escape($required)) {
            throw "Schema AD-4 incompleto: $required"
        }
    }

    $controller = Get-Content "apps/api/src/albums/album-proposals.controller.ts" -Raw
    foreach ($required in @(
        "@Post()",
        "@Get()",
        "@Post(':proposalId/approve')",
        "@Post(':proposalId/reject')"
    )) {
        if ($controller -notmatch [regex]::Escape($required)) {
            throw "Controller AD-4 incompleto: $required"
        }
    }

    Write-Host "[OK] Estructura AD-4 presente."

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

    $migrationDiff = & git status --short -- "apps/api/drizzle"
    if ($migrationDiff) {
        Write-Warning "Ya hay cambios en apps/api/drizzle. Antes de db:generate revisa que no sean residuos de otra tarea."
    } else {
        Write-Host "[OK] No hay migracion AD-4 generada todavia."
    }

    Write-Host ""
    Write-Host "[OK] iRec v0.3.0 AD-4 SOURCE GATE PASSED"
    Write-Host "[NEXT] Backup fresco -> verify -> pnpm db:generate -> revisar SQL -> irec-migrate."
}
finally {
    Pop-Location
}
