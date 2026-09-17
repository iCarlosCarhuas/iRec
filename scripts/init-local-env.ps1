param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$EnvPath = Join-Path $RepoRoot ".env"

if ((Test-Path $EnvPath) -and -not $Force) {
  Write-Host ".env ya existe en $EnvPath" -ForegroundColor Yellow
  Write-Host "Usa -Force para regenerarlo." -ForegroundColor Yellow
  exit 0
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js no esta disponible en PATH."
}

Write-Host "Generando secretos locales para iRec..." -ForegroundColor Cyan

$tmpJs = Join-Path ([System.IO.Path]::GetTempPath()) ("irec-keys-" + [guid]::NewGuid().ToString("N") + ".cjs")

$js = @'
const crypto = require('node:crypto');

const encryptionKey = crypto.randomBytes(32).toString('base64');
const recoveryPepper = crypto.randomBytes(32).toString('base64');
const sessionSecret = crypto.randomBytes(32).toString('base64');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

process.stdout.write(JSON.stringify({
  encryptionKey,
  recoveryPepper,
  sessionSecret,
  jwtPrivateKeyB64: Buffer.from(privateKey, 'utf8').toString('base64'),
  jwtPublicKeyB64: Buffer.from(publicKey, 'utf8').toString('base64')
}));
'@

try {
  Set-Content -Path $tmpJs -Value $js -Encoding UTF8

  $raw = & node $tmpJs
  if ($LASTEXITCODE -ne 0 -or -not $raw) {
    throw "No se pudo generar el material criptografico local."
  }

  $keys = $raw | ConvertFrom-Json

  if (-not (Test-Path (Join-Path $RepoRoot ".env.example"))) {
    throw "Falta .env.example en la raiz del worktree."
  }

  $content = Get-Content (Join-Path $RepoRoot ".env.example") -Raw

  # Compatibilidad con los placeholders de v0.2.0.
  $content = $content.Replace("__GENERATE_BASE64_32_BYTES__", $keys.encryptionKey)
  $content = $content.Replace("__GENERATE_JWT_PRIVATE_KEY_B64__", $keys.jwtPrivateKeyB64)
  $content = $content.Replace("__GENERATE_JWT_PUBLIC_KEY_B64__", $keys.jwtPublicKeyB64)
  $content = $content.Replace("__GENERATE_RECOVERY_PEPPER__", $keys.recoveryPepper)
  $content = $content.Replace("__GENERATE_SESSION_SECRET__", $keys.sessionSecret)

  Set-Content -Path $EnvPath -Value $content -Encoding UTF8

  Write-Host ""
  Write-Host "[OK] .env generado correctamente." -ForegroundColor Green
  Write-Host "  AES-256 key       OK"
  Write-Host "  RSA-2048 private  OK"
  Write-Host "  RSA-2048 public   OK"
  Write-Host "  Recovery pepper   OK"
  Write-Host "  Session secret    OK"
}
finally {
  Remove-Item $tmpJs -Force -ErrorAction SilentlyContinue
}
