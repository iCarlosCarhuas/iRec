import { openApiDocument } from './document.js';

const requiredPaths = [
  '/health/live',
  '/health/ready',
  '/auth/email/start',
  '/auth/email/verify',
  '/auth/totp/enroll',
  '/auth/totp/confirm',
  '/auth/login',
  '/auth/logout',
  '/auth/session',
  '/auth/recovery/email',
  '/auth/recovery/code',
];

if (openApiDocument.openapi !== '3.1.0') {
  throw new Error(`OpenAPI invalido: ${openApiDocument.openapi}`);
}

for (const path of requiredPaths) {
  if (!openApiDocument.paths?.[path]) {
    throw new Error(`Falta el path requerido: ${path}`);
  }
}

console.log(
  `OpenAPI ${openApiDocument.openapi} OK — ${Object.keys(openApiDocument.paths ?? {}).length} paths.`,
);
