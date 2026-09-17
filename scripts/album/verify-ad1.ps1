Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Push-Location $RepoRoot

try {
    Write-Host "iRec v0.3.0 - AD-1 Album Domain Gate"
    Write-Host "------------------------------------"

    $schema = Get-Content "apps/api/src/database/schema.ts" -Raw
    $albumContract = Get-Content "packages/contracts/src/album.ts" -Raw
    $contractIndex = Get-Content "packages/contracts/src/index.ts" -Raw

    foreach ($required in @(
        "export const albums",
        "export const albumMembers",
        "album_visibility",
        "album_member_role",
        "album_member_status",
        "albums_owner_idx",
        "album_members_user_status_idx"
    )) {
        if ($schema -notmatch [regex]::Escape($required)) {
            throw "Falta en database schema: $required"
        }
    }

    foreach ($required in @(
        "CreateAlbumInput",
        "UpdateAlbumInput",
        "AlbumContract",
        "AlbumMemberContract"
    )) {
        if ($albumContract -notmatch [regex]::Escape($required)) {
            throw "Falta en album contract: $required"
        }
    }

    if ($contractIndex -notmatch "['""]\./album\.js['""]") {
        throw "packages/contracts/src/index.ts no exporta ./album"
    }

    Write-Host "[OK] Estructura AD-1 presente."

    & pnpm --filter @irec/contracts build
    if ($LASTEXITCODE -ne 0) {
        throw "Contracts build fallo."
    }
    Write-Host "[OK] Contracts build."

    & pnpm --filter @irec/api typecheck
    if ($LASTEXITCODE -ne 0) {
        throw "API typecheck fallo."
    }
    Write-Host "[OK] API typecheck."

    $migrations = @(
        Get-ChildItem "apps/api/drizzle" -Filter "*.sql" -File |
        Sort-Object LastWriteTimeUtc -Descending
    )

    if ($migrations.Count -lt 2) {
        Write-Warning "Aun no aparece una nueva migracion SQL. Ejecuta pnpm db:generate."
    }
    else {
        Write-Host "[OK] Drizzle contiene migraciones SQL: $($migrations.Count)"
        Write-Host "     Ultima: $($migrations[0].Name)"
    }

    Write-Host ""
    Write-Host "[OK] iRec v0.3.0 AD-1 SOURCE GATE PASSED"
}
finally {
    Pop-Location
}
