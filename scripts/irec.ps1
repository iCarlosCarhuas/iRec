param(
  [ValidateSet('doctor', 'setup', 'up', 'down', 'status', 'logs')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$DockerEnv = Join-Path $RepoRoot '.env.docker'

function Invoke-DockerCompose {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$ComposeArgs)
  Push-Location $RepoRoot
  try {
    & docker compose @ComposeArgs
    if ($LASTEXITCODE -ne 0) { throw "docker compose fallo con codigo $LASTEXITCODE" }
  } finally {
    Pop-Location
  }
}

function Assert-Docker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker no esta disponible en PATH. Instala/inicia Docker Desktop.'
  }
  & docker info *> $null
  if ($LASTEXITCODE -ne 0) {
    throw 'Docker esta instalado, pero el daemon no responde. Inicia Docker Desktop.'
  }
  & docker compose version *> $null
  if ($LASTEXITCODE -ne 0) {
    throw 'Docker Compose v2 no esta disponible.'
  }
}


function Assert-NoForeignIrecContainers {
  $expected = @('irec-postgres', 'irec-redis', 'irec-mailpit', 'irec-migrate', 'irec-api', 'irec-web')
  foreach ($name in $expected) {
    $exists = ((& docker ps -a --filter "name=^/${name}$" --format '{{.Names}}' 2>$null | Out-String).Trim())
    if ($exists -eq $name) {
      $project = ((& docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' $name 2>$null | Out-String).Trim())
      if ($project -and $project -ne 'irec-v020') {
        throw "El contenedor $name pertenece a '$project'. Deten ese entorno antes de levantar full-stack (por ejemplo: pnpm dev:infra:down)."
      }
    }
  }
}

function Ensure-DockerEnv {
  if (Test-Path $DockerEnv) {
    Write-Host '[OK] .env.docker existe; no se regenera.' -ForegroundColor Green
    return
  }

  Write-Host '[INFO] Generando .env.docker con Node ejecutado dentro de Docker...' -ForegroundColor Cyan
  Push-Location $RepoRoot
  try {
    $mount = "${RepoRoot}:/workspace"
    & docker run --rm -v $mount -w /workspace node:24.15.0-alpine node scripts/generate-docker-env.mjs
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar .env.docker.' }
  } finally {
    Pop-Location
  }
}

function Test-Http {
  param([string]$Url, [int]$Seconds = 120)
  $deadline = (Get-Date).AddSeconds($Seconds)
  do {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) { return $true }
    } catch { }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  return $false
}

function Show-Urls {
  Write-Host ''
  Write-Host 'iRec local environment' -ForegroundColor Cyan
  Write-Host 'Web       http://127.0.0.1:4200'
  Write-Host 'API       http://127.0.0.1:3000'
  Write-Host 'Scalar    http://127.0.0.1:3000/reference'
  Write-Host 'OpenAPI   http://127.0.0.1:3000/openapi.json'
  Write-Host 'Mailpit   http://127.0.0.1:8025'
  Write-Host 'Postgres  127.0.0.1:15432'
  Write-Host 'Redis     127.0.0.1:6379'
}

Assert-Docker

switch ($Action) {
  'doctor' {
    Write-Host '[OK] Docker daemon responde.' -ForegroundColor Green
    if (Test-Path $DockerEnv) {
      Write-Host '[OK] .env.docker presente.' -ForegroundColor Green
      Invoke-DockerCompose config --quiet
      Write-Host '[OK] compose.yaml es valido.' -ForegroundColor Green
    } else {
      Write-Host '[WARN] .env.docker falta. Ejecuta: scripts/irec.ps1 setup' -ForegroundColor Yellow
      Write-Host '[INFO] La validacion completa de compose se ejecutara despues de generar el entorno.' -ForegroundColor Cyan
    }
    Show-Urls
  }

  'setup' {
    Ensure-DockerEnv
    Invoke-DockerCompose config --quiet
    Write-Host '[OK] Bootstrap Docker listo.' -ForegroundColor Green
    Write-Host 'Siguiente paso: powershell -ExecutionPolicy Bypass -File .\scripts\irec.ps1 up'
  }

  'up' {
    Assert-NoForeignIrecContainers
    Ensure-DockerEnv
    Invoke-DockerCompose up --build -d

    Write-Host '[INFO] Esperando API ready...' -ForegroundColor Cyan
    if (-not (Test-Http 'http://127.0.0.1:3000/api/health/ready')) {
      Invoke-DockerCompose ps
      throw 'La API no llego a READY dentro del tiempo esperado.'
    }

    Write-Host '[INFO] Esperando Web...' -ForegroundColor Cyan
    if (-not (Test-Http 'http://127.0.0.1:4200')) {
      Invoke-DockerCompose ps
      throw 'La Web no respondio dentro del tiempo esperado.'
    }

    Write-Host '[OK] iRec full-stack esta listo.' -ForegroundColor Green
    Invoke-DockerCompose ps
    Show-Urls
  }

  'down' {
    Invoke-DockerCompose down
    Write-Host '[OK] iRec detenido. Los volumenes se conservaron.' -ForegroundColor Green
  }

  'status' {
    Invoke-DockerCompose ps
    Show-Urls
  }

  'logs' {
    Invoke-DockerCompose logs -f
  }
}
