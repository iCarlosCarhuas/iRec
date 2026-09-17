$ErrorActionPreference = "Stop"

Write-Host "== iRec DB diagnostics ==" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Docker resources" -ForegroundColor Cyan
docker compose -f infra/docker-compose.dev.yml ps

Write-Host ""
Write-Host "2. PostgreSQL readiness" -ForegroundColor Cyan
docker compose -f infra/docker-compose.dev.yml exec -T irec-postgres `
  pg_isready -U irec -d irec

if ($LASTEXITCODE -ne 0) {
  throw "irec-postgres no esta ready."
}

Write-Host ""
Write-Host "3. PostgreSQL query" -ForegroundColor Cyan
docker compose -f infra/docker-compose.dev.yml exec -T irec-postgres `
  psql -U irec -d irec -v ON_ERROR_STOP=1 -c "select current_database(), current_user, version();"

if ($LASTEXITCODE -ne 0) {
  throw "No se pudo ejecutar una consulta en irec-postgres."
}

Write-Host ""
Write-Host "4. Current tables" -ForegroundColor Cyan
docker compose -f infra/docker-compose.dev.yml exec -T irec-postgres `
  psql -U irec -d irec -v ON_ERROR_STOP=1 -c "\dt"

Write-Host ""
Write-Host "[OK] iRec DB diagnostics passed." -ForegroundColor Green
