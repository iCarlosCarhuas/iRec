import { z } from 'zod';

export const EmailSchema = z.string().trim().email().max(254).meta({
  id: 'Email',
  example: 'persona@example.com',
});

export const TotpCodeSchema = z.string().regex(/^\d{6}$/, 'El TOTP debe tener 6 digitos').meta({
  id: 'TotpCode',
  example: '123456',
});

export const GenericAcceptedResponseSchema = z.object({
  status: z.literal('accepted'),
  message: z.string(),
}).meta({ id: 'GenericAcceptedResponse' });

export const EmailStartRequestSchema = z.object({
  email: EmailSchema,
}).meta({ id: 'EmailStartRequest' });

export const EmailVerifyRequestSchema = z.object({
  token: z.string().min(32).max(256),
}).meta({ id: 'EmailVerifyRequest' });

export const EmailVerifyResponseSchema = z.object({
  verified: z.literal(true),
  next: z.literal('TOTP_ENROLL'),
}).meta({ id: 'EmailVerifyResponse' });

export const TotpEnrollResponseSchema = z.object({
  issuer: z.string(),
  accountName: EmailSchema,
  qrDataUrl: z.string().startsWith('data:image/'),
  manualEntryKey: z.string().min(16),
}).meta({ id: 'TotpEnrollResponse' });

export const TotpConfirmRequestSchema = z.object({
  code: TotpCodeSchema,
  rememberDevice: z.boolean().default(false),
}).meta({ id: 'TotpConfirmRequest' });

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  code: TotpCodeSchema,
  rememberDevice: z.boolean().default(false),
}).meta({ id: 'LoginRequest' });

export const RecoveryEmailRequestSchema = z.object({
  email: EmailSchema,
}).meta({ id: 'RecoveryEmailRequest' });

export const RecoveryEmailVerifyRequestSchema = z.object({
  token: z.string().min(32).max(256),
}).meta({ id: 'RecoveryEmailVerifyRequest' });

export const RecoveryCodeRequestSchema = z.object({
  email: EmailSchema,
  recoveryCode: z.string().trim().min(8).max(64),
}).meta({ id: 'RecoveryCodeRequest' });

export const RecoveryReadyResponseSchema = z.object({
  recovered: z.literal(true),
  next: z.literal('TOTP_ENROLL'),
}).meta({ id: 'RecoveryReadyResponse' });

export const SessionUserSchema = z.object({
  id: z.string().uuid(),
  email: EmailSchema,
  emailVerifiedAt: z.string().datetime({ offset: true }),
}).meta({ id: 'SessionUser' });

export const SessionResponseSchema = z.discriminatedUnion('authenticated', [
  z.object({
    authenticated: z.literal(false),
  }),
  z.object({
    authenticated: z.literal(true),
    user: SessionUserSchema,
  }),
]).meta({ id: 'SessionResponse' });

export const RecoveryCodesResponseSchema = z.object({
  user: SessionUserSchema,
  recoveryCodes: z.array(z.string()).length(10),
}).meta({
  id: 'RecoveryCodesResponse',
  description: 'Los recovery codes se entregan una sola vez.',
});

export const TotpRotateRequestSchema = z.object({
  currentCode: TotpCodeSchema,
}).meta({ id: 'TotpRotateRequest' });

export const TotpRotateConfirmRequestSchema = z.object({
  code: TotpCodeSchema,
}).meta({ id: 'TotpRotateConfirmRequest' });

export const TrustedDeviceSchema = z.object({
  id: z.string().uuid(),
  userAgent: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  lastUsedAt: z.string().datetime({ offset: true }).nullable(),
  expiresAt: z.string().datetime({ offset: true }),
}).meta({ id: 'TrustedDevice' });

export const TrustedDevicesResponseSchema = z.object({
  devices: z.array(TrustedDeviceSchema),
}).meta({ id: 'TrustedDevicesResponse' });

export const DeviceIdParamsSchema = z.object({
  deviceId: z.string().uuid(),
}).meta({ id: 'DeviceIdParams' });

export const SuccessResponseSchema = z.object({
  success: z.literal(true),
}).meta({ id: 'SuccessResponse' });

export type EmailStartRequest = z.infer<typeof EmailStartRequestSchema>;
export type EmailVerifyRequest = z.infer<typeof EmailVerifyRequestSchema>;
export type EmailVerifyResponse = z.infer<typeof EmailVerifyResponseSchema>;
export type GenericAcceptedResponse = z.infer<typeof GenericAcceptedResponseSchema>;

export type TotpEnrollResponse = z.infer<typeof TotpEnrollResponseSchema>;
export type TotpConfirmRequest = z.infer<typeof TotpConfirmRequestSchema>;

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export type RecoveryEmailRequest = z.infer<typeof RecoveryEmailRequestSchema>;
export type RecoveryEmailVerifyRequest = z.infer<typeof RecoveryEmailVerifyRequestSchema>;
export type RecoveryCodeRequest = z.infer<typeof RecoveryCodeRequestSchema>;
export type RecoveryReadyResponse = z.infer<typeof RecoveryReadyResponseSchema>;
export type RecoveryCodesResponse = z.infer<typeof RecoveryCodesResponseSchema>;

export type TotpRotateRequest = z.infer<typeof TotpRotateRequestSchema>;
export type TotpRotateConfirmRequest = z.infer<typeof TotpRotateConfirmRequestSchema>;

export type SessionResponse = z.infer<typeof SessionResponseSchema>;
export type SessionUser = z.infer<typeof SessionUserSchema>;

export type TrustedDevice = z.infer<typeof TrustedDeviceSchema>;
export type TrustedDevicesResponse = z.infer<typeof TrustedDevicesResponseSchema>;
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
