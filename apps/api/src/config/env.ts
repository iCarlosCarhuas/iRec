import { z } from 'zod';

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}, z.boolean());

const encryptionKey = z.string().refine((value) => {
  try { return Buffer.from(value, 'base64').length === 32; } catch { return false; }
}, 'APP_ENCRYPTION_KEY debe ser Base64 de exactamente 32 bytes');

const base64Pem = z.string().min(100).refine((value) => {
  try { return Buffer.from(value, 'base64').toString('utf8').includes('KEY-----'); } catch { return false; }
}, 'JWT key debe ser un PEM codificado en Base64');

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().url().default('http://localhost:4200'),
  PUBLIC_WEB_URL: z.string().url().default('http://localhost:4200'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  APP_ENCRYPTION_KEY: encryptionKey,
  JWT_PRIVATE_KEY_B64: base64Pem,
  JWT_PUBLIC_KEY_B64: base64Pem,
  JWT_ISSUER: z.string().min(1).default('irec'),
  JWT_AUDIENCE: z.string().min(1).default('irec-web'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(43_200),
  COOKIE_SECURE: booleanFromEnv.default(false),
  TRUSTED_DEVICE_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),
  AUTH_FLOW_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  EMAIL_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  TOTP_ISSUER: z.string().min(1).max(64).default('iRec'),
  BCRYPT_COST: z.coerce.number().int().min(10).max(14).default(12),
  EMAIL_TRANSPORT: z.enum(['smtp', 'resend']).default('smtp'),
  EMAIL_FROM: z.string().min(3),
  SMTP_HOST: z.string().default('127.0.0.1'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  RESEND_API_KEY: z.string().optional(),
}).superRefine((env, ctx) => {
  if (env.EMAIL_TRANSPORT === 'resend' && !env.RESEND_API_KEY) {
    ctx.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'RESEND_API_KEY es requerido cuando EMAIL_TRANSPORT=resend' });
  }
});
export type Env = z.infer<typeof EnvSchema>;
export function validateEnv(input: Record<string, unknown>): Env { return EnvSchema.parse(input); }
