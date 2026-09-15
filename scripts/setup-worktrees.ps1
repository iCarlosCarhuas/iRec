$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Parent = Split-Path $RepoRoot -Parent
$WorktreeRoot = Join-Path $Parent "iRec-worktrees"

Write-Host ""
Write-Host "== iRec worktree setup ==" -ForegroundColor Cyan
Write-Host "Main repo: $RepoRoot"
Write-Host "Worktrees: $WorktreeRoot"
Write-Host ""

Set-Location $RepoRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git no esta instalado o no esta disponible en PATH."
}

if (-not (Test-Path (Join-Path $RepoRoot ".git"))) {
  Write-Host "Inicializando Git..." -ForegroundColor Yellow
  git init -b main

  $name = git config user.name
  $email = git config user.email

  if (-not $name -or -not $email) {
    Write-Host ""
    Write-Host "Git necesita user.name y user.email para crear el primer commit." -ForegroundColor Yellow
    Write-Host "Configuralos y vuelve a ejecutar el script:"
    Write-Host '  git config --global user.name "Tu Nombre"'
    Write-Host '  git config --global user.email "tu@email.com"'
    exit 1
  }

  git add .
  git commit -m "chore: initialize iRec v0.1.0"
} else {
  Write-Host "Repositorio Git existente detectado." -ForegroundColor Green

  $branch = git branch --show-current
  if (-not $branch) {
    throw "El repositorio esta en detached HEAD. Cambia a una rama antes de continuar."
  }

  if ($branch -ne "main") {
    Write-Host "La rama actual es '$branch'. Se mantendra sin modificar." -ForegroundColor Yellow
  }

  $hasCommit = git rev-parse --verify HEAD 2>$null
  if (-not $hasCommit) {
    git add .
    git commit -m "chore: initialize iRec v0.1.0"
  }
}

New-Item -ItemType Directory -Force -Path $WorktreeRoot | Out-Null

$definitions = @(
  @{ Name = "frontend"; Branch = "feat/frontend" },
  @{ Name = "backend";  Branch = "feat/backend" },
  @{ Name = "docs";     Branch = "docs/project" }
)

foreach ($def in $definitions) {
  $path = Join-Path $WorktreeRoot $def.Name
  $branch = $def.Branch

  $branchExists = git show-ref --verify --quiet "refs/heads/$branch"
  $pathExists = Test-Path $path

  if ($pathExists) {
    Write-Host "Ya existe: $path" -ForegroundColor DarkGray
    continue
  }

  if ($LASTEXITCODE -eq 0) {
    Write-Host "Creando worktree '$($def.Name)' desde rama existente '$branch'..." -ForegroundColor Cyan
    git worktree add $path $branch
  } else {
    Write-Host "Creando worktree '$($def.Name)' y rama '$branch'..." -ForegroundColor Cyan
    git worktree add -b $branch $path main
  }
}

Write-Host ""
Write-Host "Worktrees configurados:" -ForegroundColor Green
git worktree list

Write-Host ""
Write-Host "Siguientes pasos:" -ForegroundColor Cyan
Write-Host "  Frontend : cd `"$WorktreeRoot\frontend`""
Write-Host "  Backend  : cd `"$WorktreeRoot\backend`""
Write-Host "  Docs     : cd `"$WorktreeRoot\docs`""
Write-Host ""
