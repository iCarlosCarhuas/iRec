$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "iRec v0.3.0 - AD-7 Release Source Gate"
Write-Host "---------------------------------------"

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw "[FAIL] $Message"
    }

    Write-Host "[OK] $Message"
}

function Run-Step {
    param(
        [string]$Label,
        [scriptblock]$Command
    )

    Write-Host ""
    Write-Host "`$ $Label"
    & $Command

    if ($LASTEXITCODE -ne 0) {
        throw "[FAIL] $Label"
    }

    Write-Host "[OK] $Label"
}

$root = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $root

Assert-True (-not (Test-Path "V030-RELEASE-CONTEXT.txt")) "Contexto temporal removido antes del release"

$branch = (git branch --show-current).Trim()
Assert-True ($branch -eq "feat/v030-e2e-release" -or $branch -eq "integration/v0.3.0" -or $branch -eq "main") "Rama de release reconocida: $branch"

$expectedVersion = "0.3.0"
$packagePaths = @(
    "package.json",
    "apps/api/package.json",
    "apps/web/package.json",
    "packages/contracts/package.json"
)

foreach ($path in $packagePaths) {
    $json = Get-Content $path -Raw | ConvertFrom-Json
    Assert-True ($json.version -eq $expectedVersion) "$path version = $expectedVersion"
}

$compose = Get-Content "compose.yaml" -Raw
Assert-True (-not $compose.Contains("irec-api:0.2.0-dev")) "compose sin irec-api:0.2.0-dev"
Assert-True (-not $compose.Contains("irec-web:0.2.0-dev")) "compose sin irec-web:0.2.0-dev"
Assert-True ($compose.Contains("irec-api:0.3.0-dev")) "compose usa irec-api:0.3.0-dev"
Assert-True ($compose.Contains("irec-web:0.3.0-dev")) "compose usa irec-web:0.3.0-dev"

$tech = Get-Content "docs/TECH/CHANGELOG.md" -Raw
$nontech = Get-Content "docs/NONTECH/CHANGELOG.md" -Raw
Assert-True ($tech.Contains("## [0.3.0] - 2026-09-25")) "TECH changelog contiene v0.3.0"
Assert-True ($nontech.Contains("## [0.3.0] - 2026-09-25")) "NONTECH changelog contiene v0.3.0"
Assert-True (-not $nontech.Contains("`v0.2.0`: todavía no liberado.")) "NONTECH ya no marca v0.2.0 como no liberado"


$trackedBuildInfo = @(
    git ls-files | Select-String -Pattern "\\.tsbuildinfo$"
)
Assert-True ($trackedBuildInfo.Count -eq 0) "No hay tsbuildinfo versionados"

$apiBuildConfig = Get-Content "apps/api/tsconfig.build.json" -Raw | ConvertFrom-Json
Assert-True ($apiBuildConfig.compilerOptions.incremental -eq $false) "API production build usa incremental=false"

$apiDockerfile = Get-Content "apps/api/Dockerfile" -Raw
Assert-True ($apiDockerfile.Contains("rm -rf apps/api/dist apps/api/tsconfig*.tsbuildinfo")) "Docker API limpia dist/buildinfo antes de compilar"

$gitignore = Get-Content ".gitignore" -Raw
$dockerignore = Get-Content ".dockerignore" -Raw
Assert-True ($gitignore.Contains("**/*.tsbuildinfo")) ".gitignore excluye tsbuildinfo"
Assert-True ($dockerignore.Contains("**/*.tsbuildinfo")) ".dockerignore excluye tsbuildinfo"

Run-Step "git diff --check" { git diff --check }
Run-Step "docker compose config --quiet" { docker compose config --quiet }

Run-Step "Contracts build" { pnpm --filter @irec/contracts build }
Run-Step "API typecheck" { pnpm --filter @irec/api typecheck }
Run-Step "API tests" { pnpm --filter @irec/api test }
Run-Step "OpenAPI check" { pnpm --filter @irec/api openapi:check }
Run-Step "API build" { pnpm --filter @irec/api build }
Run-Step "Web typecheck" { pnpm --filter @irec/web typecheck }
Run-Step "Web production build" { pnpm --filter @irec/web build }

Write-Host ""
Write-Host "[OK] iRec v0.3.0 AD-7 SOURCE/RELEASE GATE PASSED"
Write-Host "[SAFE] No se aplicaron migraciones ni operaciones destructivas."
Write-Host "[NEXT] Ejecutar Runtime/E2E Gate de docs/RELEASE/V0.3.0-E2E.md antes de taggear."
