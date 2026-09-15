param(
  [switch]$SkipInstall,
  [switch]$SkipInfra,
  [switch]$SkipDev,
  [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"

function Run([string]$cmd) {
  Write-Host "> $cmd" -ForegroundColor DarkGray
  & cmd.exe /d /s /c $cmd
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo ($LASTEXITCODE): $cmd"
  }
}

function WaitUrl([string]$url, [int]$timeout) {
  $end = (Get-Date).AddSeconds($timeout)
  while ((Get-Date) -lt $end) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { return $true }
    } catch {}
    Start-Sleep -Seconds 2
  }
  return $false
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

Write-Host "== iRec v0.2.0 Identity backend gate ==" -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
  & (Join-Path $PSScriptRoot "init-local-env.ps1")
}

if (-not $SkipInstall) {
  Run "pnpm install"
}

if (-not $SkipInfra) {
  Run "pnpm dev:infra"
}

Run "pnpm db:diagnose"
Run "pnpm typecheck"
Run "pnpm openapi:check"
Run "pnpm build"
Run "pnpm db:apply"

if ($SkipDev) {
  Write-Host "STATIC IDENTITY BACKEND CHECKS PASSED" -ForegroundColor Green
  exit 0
}

$tmp = Join-Path $RepoRoot ".tmp"
New-Item -ItemType Directory -Force $tmp | Out-Null
$out = Join-Path $tmp "identity-api.out.log"
$err = Join-Path $tmp "identity-api.err.log"
Remove-Item $out,$err -Force -ErrorAction SilentlyContinue

$p = Start-Process `
  -FilePath "cmd.exe" `
  -ArgumentList "/d","/s","/c","pnpm dev:api" `
  -WorkingDirectory $RepoRoot `
  -RedirectStandardOutput $out `
  -RedirectStandardError $err `
  -PassThru

$ok = (WaitUrl "http://localhost:3000/api/health/live" $TimeoutSeconds) -and
      (WaitUrl "http://localhost:3000/api/health/ready" $TimeoutSeconds) -and
      (WaitUrl "http://localhost:3000/openapi.json" $TimeoutSeconds) -and
      (WaitUrl "http://localhost:3000/reference" $TimeoutSeconds) -and
      (WaitUrl "http://localhost:8025" $TimeoutSeconds)

if (-not $ok) {
  Write-Host "--- stdout ---"
  Get-Content $out -Tail 100 -ErrorAction SilentlyContinue
  Write-Host "--- stderr ---"
  Get-Content $err -Tail 100 -ErrorAction SilentlyContinue
  if (-not $p.HasExited) { taskkill /PID $p.Id /T /F | Out-Null }
  throw "Identity backend smoke test fallo."
}

Write-Host ""
Write-Host "iRec v0.2.0 IDENTITY BACKEND PASSED" -ForegroundColor Green
Write-Host "Scalar:  http://localhost:3000/reference"
Write-Host "Mailpit: http://localhost:8025"
Write-Host ""
Write-Host "API queda ejecutandose. PID launcher: $($p.Id)"
