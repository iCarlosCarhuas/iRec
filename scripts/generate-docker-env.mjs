import { existsSync, writeFileSync } from 'node:fs';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const output = resolve(process.cwd(), '.env.docker');
const force = process.argv.includes('--force');

if (existsSync(output) && !force) {
  console.log('[irec-docker] .env.docker ya existe. No se regenera.');
  process.exit(0);
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const b64 = (value) => Buffer.from(value, 'utf8').toString('base64');

const env = [
  '# iRec v0.2.0 — generated local Docker environment',
  '# DO NOT COMMIT. Regenerate only when you intentionally want new local cryptographic material.',
  'NODE_ENV=development',
  'API_PORT=3000',
  'WEB_ORIGIN=http://127.0.0.1:4200',
  'PUBLIC_WEB_URL=http://127.0.0.1:4200',
  'DATABASE_URL=postgresql://irec:irec_dev@irec-postgres:5432/irec',
  'REDIS_URL=redis://irec-redis:6379',
  `APP_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`,
  `JWT_PRIVATE_KEY_B64=${b64(privateKey)}`,
  `JWT_PUBLIC_KEY_B64=${b64(publicKey)}`,
  'JWT_ISSUER=irec',
  'JWT_AUDIENCE=irec-web',
  'ACCESS_TOKEN_TTL_SECONDS=900',
  'REFRESH_TOKEN_TTL_SECONDS=43200',
  'COOKIE_SECURE=false',
  'TRUSTED_DEVICE_TTL_SECONDS=2592000',
  'AUTH_FLOW_TTL_SECONDS=900',
  'EMAIL_TOKEN_TTL_SECONDS=900',
  'TOTP_ISSUER=iRec',
  'BCRYPT_COST=12',
  'EMAIL_TRANSPORT=smtp',
  'EMAIL_FROM="iRec <no-reply@irec.local>"',
  'SMTP_HOST=irec-mailpit',
  'SMTP_PORT=1025',
  'RESEND_API_KEY=',
  '',
].join('\n');

writeFileSync(output, env, { encoding: 'utf8', mode: 0o600 });
console.log('[irec-docker] .env.docker generado.');
console.log('[irec-docker] No lo agregues a Git.');
