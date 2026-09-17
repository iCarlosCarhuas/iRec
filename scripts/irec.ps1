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

  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & docker info *> $null
    $dockerInfoExit = $LASTEXITCODE

    & docker compose version *> $null
    $composeExit = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }

  if ($dockerInfoExit -ne 0) {
    throw 'Docker esta instalado, pero el daemon no responde. Inicia Docker Desktop.'
  }

  if ($composeExit -ne 0) {
    throw 'Docker Compose v2 no esta disponible.'
  }
}

function Get-ContainerComposeProject {
  param([string]$ContainerName)

  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $raw = (& docker inspect $ContainerName 2>$null | Out-String)
    $inspectExit = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }

  if ($inspectExit -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) {
    return $null
  }

  try {
    $inspect = $raw | ConvertFrom-Json
    if (-not $inspect -or $inspect.Count -lt 1) {
      return $null
    }

    $labels = $inspect[0].Config.Labels
    if (-not $labels) {
      return $null
    }

    return $labels.'com.docker.compose.project'
  } catch {
    throw "No se pudo interpretar docker inspect para '$ContainerName': $($_.Exception.Message)"
  }
}

function Assert-NoForeignIrecContainers {
  $expected = @(
    'irec-postgres',
    'irec-redis',
    'irec-mailpit',
    'irec-migrate',
    'irec-api',
    'irec-web'
  )

  foreach ($name in $expected) {
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
      $exists = ((& docker ps -a --filter "name=^/${name}$" --format '{{.Names}}' 2>$null | Out-String).Trim())
      $psExit = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $previousPreference
    }

    if ($psExit -ne 0) {
      throw "No se pudo consultar Docker para verificar el contenedor '$name'."
    }

    if ($exists -eq $name) {
      $project = Get-ContainerComposeProject -ContainerName $name

      if ($project -and $project -ne 'irec-v020') {
        throw "El contenedor $name pertenece a '$project'. Deten ese entorno antes de levantar full-stack (por ejemplo: pnpm dev:infra:down)."
      }

      if (-not $project) {
        throw "El contenedor $name ya existe pero no pertenece a un proyecto Compose identificable. Revisalo antes de continuar: docker inspect $name"
      }
    }
  }
}

function Invoke-EnvGeneratorWithLocalNode {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { return $false }

  Write-Host "[INFO] Generando .env.docker con Node local: $($node.Source)" -ForegroundColor Cyan
  Push-Location $RepoRoot
  try {
    & node scripts/generate-docker-env.mjs
    if ($LASTEXITCODE -ne 0) {
      Write-Host '[WARN] Node local no pudo generar .env.docker; se intentara Docker como fallback.' -ForegroundColor Yellow
      return $false
    }
  } finally {
    Pop-Location
  }

  return (Test-Path $DockerEnv)
}

function Invoke-EnvGeneratorWithDocker {
  $image = 'node:24.15.0-alpine'

  Write-Host "[INFO] Node local no disponible. Usando $image." -ForegroundColor Cyan

  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & docker image inspect $image *> $null
    $imageExists = ($LASTEXITCODE -eq 0)
  } finally {
    $ErrorActionPreference = $previousPreference
  }

  if (-not $imageExists) {
    Write-Host "[INFO] Descargando $image. El progreso debe verse en pantalla..." -ForegroundColor Cyan
    & docker pull $image
    if ($LASTEXITCODE -ne 0) {
      throw "No se pudo descargar $image. Revisa red/Docker Desktop."
    }
  }

  Push-Location $RepoRoot
  try {
    $mount = "${RepoRoot}:/workspace"
    Write-Host '[INFO] Ejecutando generador dentro de Docker...' -ForegroundColor Cyan
    & docker run --rm -v $mount -w /workspace $image node scripts/generate-docker-env.mjs
    if ($LASTEXITCODE -ne 0) {
      throw 'No se pudo generar .env.docker usando Docker.'
    }
  } finally {
    Pop-Location
  }
}

function Ensure-DockerEnv {
  if (Test-Path $DockerEnv) {
    Write-Host '[OK] .env.docker existe; no se regenera.' -ForegroundColor Green
    return
  }

  if (Invoke-EnvGeneratorWithLocalNode) {
    Write-Host '[OK] .env.docker generado con Node local.' -ForegroundColor Green
    return
  }

  Invoke-EnvGeneratorWithDocker

  if (-not (Test-Path $DockerEnv)) {
    throw '.env.docker no fue creado.'
  }

  Write-Host '[OK] .env.docker generado mediante Docker.' -ForegroundColor Green
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
  Write-Host 'Postgres  internal: irec-postgres:5432'
  Write-Host 'Redis     internal: irec-redis:6379'
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
