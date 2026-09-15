$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Parent = Split-Path $RepoRoot -Parent
$WorktreeRoot = Join-Path $Parent "iRec-worktrees"

if (-not (Get-Command wt.exe -ErrorAction SilentlyContinue)) {
  Write-Host "Windows Terminal (wt.exe) no esta disponible."
  Write-Host "Abre manualmente:"
  Write-Host "  $RepoRoot"
  Write-Host "  $WorktreeRoot\frontend"
  Write-Host "  $WorktreeRoot\backend"
  Write-Host "  $WorktreeRoot\docs"
  exit 0
}

wt.exe `
  -d "$RepoRoot" `
  `; new-tab -d "$WorktreeRoot\frontend" `
  `; new-tab -d "$WorktreeRoot\backend" `
  `; new-tab -d "$WorktreeRoot\docs"
