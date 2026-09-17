param(
  [string]$Branch = 'integration/v0.2.0',
  [string]$TargetPath = ''
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Parent = Split-Path $RepoRoot -Parent

if (-not $TargetPath) {
  $TargetPath = Join-Path (Join-Path $Parent 'iRec-worktrees') 'v0.2.0'
}

$dirty = (& git -C $RepoRoot status --porcelain)
if ($dirty) {
  throw 'El worktree desde el que ejecutas este script tiene cambios. Haz commit/stash antes de crear la integracion.'
}

& git -C $RepoRoot fetch origin
if ($LASTEXITCODE -ne 0) { throw 'git fetch fallo.' }

if (Test-Path $TargetPath) {
  throw "El destino ya existe: $TargetPath"
}

$branchExists = ((& git -C $RepoRoot branch --list $Branch | Out-String).Trim())
if ($branchExists) {
  & git -C $RepoRoot worktree add $TargetPath $Branch
} else {
  & git -C $RepoRoot worktree add -b $Branch $TargetPath main
}
if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el worktree de integracion.' }

Write-Host ''
Write-Host '[OK] Worktree de integracion creado:' -ForegroundColor Green
Write-Host "     $TargetPath"
Write-Host ''
Write-Host 'Fusiona las ramas en este orden:' -ForegroundColor Cyan
Write-Host "  git -C `"$TargetPath`" merge --no-ff feat/backend"
Write-Host "  git -C `"$TargetPath`" merge --no-ff feat/frontend"
Write-Host "  git -C `"$TargetPath`" merge --no-ff docs/project"
Write-Host ''
Write-Host 'Si Git reporta conflicto, resolverlo antes de continuar con el siguiente merge.' -ForegroundColor Yellow
