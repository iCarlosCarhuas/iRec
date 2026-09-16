param(
  [switch]$RemoveLegacyVolumes
)

$ErrorActionPreference = "Stop"

Write-Host "== iRec infrastructure naming migration ==" -ForegroundColor Cyan
Write-Host ""

$legacyContainers = @(
  "infra-postgres-1",
  "infra-redis-1",
  "infra-mailpit-1"
)

foreach ($container in $legacyContainers) {
  $exists = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq $container }
  if ($exists) {
    Write-Host "Eliminando contenedor legacy: $container" -ForegroundColor Yellow
    docker rm -f $container | Out-Null
  }
}

$legacyNetwork = docker network ls --format "{{.Name}}" | Where-Object { $_ -eq "infra_default" }
if ($legacyNetwork) {
  Write-Host "Eliminando red legacy: infra_default" -ForegroundColor Yellow
  docker network rm infra_default | Out-Null
}

if ($RemoveLegacyVolumes) {
  $legacyVolumes = @("infra_irec_postgres", "infra_irec_redis")
  foreach ($volume in $legacyVolumes) {
    $exists = docker volume ls --format "{{.Name}}" | Where-Object { $_ -eq $volume }
    if ($exists) {
      Write-Host "Eliminando volumen legacy: $volume" -ForegroundColor Yellow
      docker volume rm $volume | Out-Null
    }
  }
} else {
  Write-Host ""
  Write-Host "Los volumenes legacy NO se eliminaron:" -ForegroundColor DarkYellow
  Write-Host "  infra_irec_postgres"
  Write-Host "  infra_irec_redis"
  Write-Host "Esto evita perdida accidental de datos."
  Write-Host "Si quieres borrarlos posteriormente:"
  Write-Host "  .\scripts\migrate-infra-naming.ps1 -RemoveLegacyVolumes"
}

Write-Host ""
Write-Host "Levantando infraestructura iRec..." -ForegroundColor Cyan
docker compose -f infra/docker-compose.dev.yml up -d --wait

if ($LASTEXITCODE -ne 0) {
  throw "No se pudo levantar irec-infra."
}

Write-Host ""
docker compose -f infra/docker-compose.dev.yml ps

Write-Host ""
Write-Host "[OK] Migracion completada." -ForegroundColor Green
Write-Host "Proyecto Compose : irec-infra"
Write-Host "PostgreSQL       : irec-postgres"
Write-Host "Redis            : irec-redis"
Write-Host "Mailpit          : irec-mailpit"
Write-Host "Network          : irec-network"
