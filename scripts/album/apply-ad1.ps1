param(
    [switch]$SkipContracts,
    [switch]$SkipDatabase
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$SchemaPath = Join-Path $RepoRoot "apps\api\src\database\schema.ts"
$ContractsIndex = Join-Path $RepoRoot "packages\contracts\src\index.ts"
$AlbumContract = Join-Path $RepoRoot "packages\contracts\src\album.ts"

function Assert-File([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Archivo requerido no encontrado: $Path"
    }
}

function Backup-TextFile([string]$Path) {
    Copy-Item -LiteralPath $Path -Destination "$Path.ad1.bak" -Force
}

function Restore-OnFailure([string]$Path) {
    $bak = "$Path.ad1.bak"
    if (Test-Path -LiteralPath $bak) {
        Copy-Item -LiteralPath $bak -Destination $Path -Force
    }
}

function Remove-Backup([string]$Path) {
    $bak = "$Path.ad1.bak"
    if (Test-Path -LiteralPath $bak) {
        Remove-Item -LiteralPath $bak -Force
    }
}

Assert-File $SchemaPath
Assert-File $ContractsIndex
Assert-File $AlbumContract

if (-not $SkipContracts) {
    $indexText = Get-Content -LiteralPath $ContractsIndex -Raw

    if ($indexText -notmatch "['""]\./album\.js['""]") {
        Backup-TextFile $ContractsIndex
        try {
            if (-not $indexText.EndsWith("`n")) {
                $indexText += "`r`n"
            }
            $indexText += "export * from './album.js';`r`n"
            Set-Content -LiteralPath $ContractsIndex -Value $indexText -Encoding UTF8
            Remove-Backup $ContractsIndex
            Write-Host "[OK] packages/contracts/src/index.ts exporta ./album"
        }
        catch {
            Restore-OnFailure $ContractsIndex
            throw
        }
    }
    else {
        Write-Host "[SKIP] El contrato album ya esta exportado."
    }
}

if (-not $SkipDatabase) {
    $schemaText = Get-Content -LiteralPath $SchemaPath -Raw

    if ($schemaText -match "export const albums\s*=") {
        Write-Host "[SKIP] Album schema ya existe en schema.ts."
        exit 0
    }

    Backup-TextFile $SchemaPath

    $importBlock = @"
import {
  index as irecIndex,
  pgEnum as irecPgEnum,
  pgTable as irecPgTable,
  primaryKey as irecPrimaryKey,
  text as irecText,
  timestamp as irecTimestamp,
  uuid as irecUuid,
  varchar as irecVarchar,
} from 'drizzle-orm/pg-core';

"@

    $schemaBlock = @'

// -----------------------------------------------------------------------------
// iRec v0.3.0 - Album Core / AD-1
// -----------------------------------------------------------------------------

export const albumVisibilityEnum = irecPgEnum('album_visibility', [
  'public',
  'private',
]);

export const albumMemberRoleEnum = irecPgEnum('album_member_role', [
  'owner',
  'member',
]);

export const albumMemberStatusEnum = irecPgEnum('album_member_status', [
  'active',
  'invited',
  'removed',
]);

export const albums = irecPgTable(
  'albums',
  {
    id: irecUuid('id').defaultRandom().primaryKey(),
    ownerId: irecUuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: irecVarchar('title', { length: 160 }).notNull(),
    description: irecText('description'),
    visibility: albumVisibilityEnum('visibility').notNull().default('private'),
    createdAt: irecTimestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: irecTimestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    irecIndex('albums_owner_idx').on(table.ownerId),
    irecIndex('albums_visibility_idx').on(table.visibility),
  ],
);

export const albumMembers = irecPgTable(
  'album_members',
  {
    albumId: irecUuid('album_id')
      .notNull()
      .references(() => albums.id, { onDelete: 'cascade' }),
    userId: irecUuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: albumMemberRoleEnum('role').notNull().default('member'),
    status: albumMemberStatusEnum('status').notNull().default('active'),
    joinedAt: irecTimestamp('joined_at', { withTimezone: true }),
    createdAt: irecTimestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: irecTimestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    irecPrimaryKey({ columns: [table.albumId, table.userId] }),
    irecIndex('album_members_user_status_idx').on(table.userId, table.status),
    irecIndex('album_members_album_role_idx').on(table.albumId, table.role),
  ],
);

// Application invariant for AD-1:
// every album owner must also have exactly one ACTIVE OWNER membership.
// The service layer will enforce this atomically when album creation is added.
// owner_id remains on albums for ownership queries and referential clarity.
'@

    try {
        $newText = $importBlock + $schemaText.TrimStart([char]0xFEFF) + "`r`n" + $schemaBlock + "`r`n"
        Set-Content -LiteralPath $SchemaPath -Value $newText -Encoding UTF8
        Remove-Backup $SchemaPath
        Write-Host "[OK] Album schema AD-1 agregado a apps/api/src/database/schema.ts"
    }
    catch {
        Restore-OnFailure $SchemaPath
        throw
    }
}

Write-Host ""
Write-Host "AD-1 source patch aplicado."
Write-Host "No se genero ni aplico ninguna migracion automaticamente."
Write-Host ""
Write-Host "Siguiente:"
Write-Host "  pnpm --filter @irec/contracts build"
Write-Host "  pnpm --filter @irec/api typecheck"
Write-Host "  pnpm db:generate"
