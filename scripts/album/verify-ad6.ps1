$ErrorActionPreference = "Stop"

Write-Host "iRec v0.3.0 - AD-6 Public Album View Source Gate"
Write-Host "---------------------------------------------------"

$required = @(
  "apps/web/src/app/features/albums/public-album.page.ts",
  "apps/web/src/app/features/albums/album-detail.page.ts",
  "apps/web/src/app/app.routes.ts",
  "apps/web/src/styles.css",
  "docs/FRONTEND/PUBLIC-ALBUM-VIEW.md"
)

foreach ($path in $required) {
  if (-not (Test-Path $path)) {
    throw "Falta archivo AD-6: $path"
  }
}
Write-Host "[OK] Estructura AD-6 presente."

$status = @(git status --porcelain)
$forbidden = @($status | Where-Object {
  $_ -match ' apps/api/' -or
  $_ -match ' packages/contracts/' -or
  $_ -match ' apps/api/drizzle/'
})

if ($forbidden.Count -gt 0) {
  Write-Host "[ERROR] AD-6 no debe tocar backend/contracts/migraciones:"
  $forbidden | ForEach-Object { Write-Host $_ }
  exit 1
}
Write-Host "[OK] Sin cambios de backend/schema/migraciones."

$routes = Get-Content "apps/web/src/app/app.routes.ts" -Raw
if ($routes -notmatch "path:\s*'a/:albumId'") {
  throw "No existe la ruta publica /a/:albumId."
}

$page = Get-Content "apps/web/src/app/features/albums/public-album.page.ts" -Raw
if ($page -notmatch "album\.visibility === 'public'") {
  throw "La vista publica no valida visibility=public."
}
if ($page -match 'members\(' -or $page -match 'proposals\(') {
  throw "La vista publica no debe consultar miembros/propuestas."
}
Write-Host "[OK] Ruta publica y aislamiento de datos verificados."

Write-Host ""
Write-Host '$ pnpm --filter @irec/contracts build'
pnpm --filter @irec/contracts build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "[OK] Contracts build."

Write-Host ""
Write-Host '$ pnpm --filter @irec/web typecheck'
pnpm --filter @irec/web typecheck
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "[OK] Web typecheck."

Write-Host ""
Write-Host '$ pnpm --filter @irec/web build'
pnpm --filter @irec/web build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "[OK] Web production build."

Write-Host ""
Write-Host "[OK] iRec v0.3.0 AD-6 SOURCE GATE PASSED"
Write-Host "[NEXT] Runtime: album public -> /a/:id anonimo = visible; album private -> no disponible."
