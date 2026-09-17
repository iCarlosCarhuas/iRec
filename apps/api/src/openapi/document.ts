import {
  DeviceIdParamsSchema,
  EmailStartRequestSchema,
  EmailVerifyRequestSchema,
  EmailVerifyResponseSchema,
  GenericAcceptedResponseSchema,
  HealthResponseSchema,
  LoginRequestSchema,
  ProblemDetailsSchema,
  RecoveryCodeRequestSchema,
  RecoveryCodesResponseSchema,
  RecoveryEmailRequestSchema,
  RecoveryEmailVerifyRequestSchema,
  RecoveryReadyResponseSchema,
  SessionResponseSchema,
  SuccessResponseSchema,
  TotpConfirmRequestSchema,
  TotpEnrollResponseSchema,
  TotpRotateConfirmRequestSchema,
  TotpRotateRequestSchema,
  TrustedDevicesResponseSchema,
} from '@irec/contracts';
import {
  AlbumContract,
  AlbumIdParamsSchema,
  AlbumListResponseSchema,
  CreateAlbumInput,
  UpdateAlbumInput,
} from '@irec/contracts';
import { createDocument } from 'zod-openapi';
import type { ZodType } from 'zod';

const json = (schema: ZodType) => ({
  'application/json': { schema },
});

const problemResponses = {
  '400': {
    description: 'Solicitud invalida',
    content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
  },
  '401': {
    description: 'No autenticado',
    content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
  },
  '422': {
    description: 'Error de validacion',
    content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
  },
  '429': {
    description: 'Rate limit',
    content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
  },
};

export const openApiDocument = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'iRec API',
    version: '0.3.0-dev',
    description: `Contrato HTTP de iRec. Zod es la fuente de verdad y Scalar renderiza esta referencia.

## Quick start local (full-stack Docker)

Primera vez:

\`\`\`powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\irec.ps1 setup
\`\`\`

Levantar iRec completo:

\`\`\`bash
docker compose up --build -d
\`\`\`

O usando el wrapper del proyecto:

\`\`\`bash
pnpm irec:dev
\`\`\`

Web: http://127.0.0.1:4200 · API: http://127.0.0.1:3000 · Mailpit: http://127.0.0.1:8025`,
  },
  servers: [{ url: '/api', description: 'Entorno actual' }],
  tags: [
    { name: 'Health', description: 'Estado del servicio' },
    { name: 'Auth', description: 'Identity passwordless: email + TOTP' },
    { name: 'Albums', description: 'Album Core: ownership, visibility y membresias' },
  ],
  paths: {
    '/health/live': {
      get: {
        operationId: 'healthLive',
        tags: ['Health'],
        summary: 'Liveness de la API',
        responses: {
          '200': { description: 'API ejecutandose', content: json(HealthResponseSchema) },
        },
      },
    },
    '/health/ready': {
      get: {
        operationId: 'healthReady',
        tags: ['Health'],
        summary: 'PostgreSQL y Redis disponibles',
        responses: {
          '200': { description: 'Servicio listo', content: json(HealthResponseSchema) },
          '503': {
            description: 'Dependencia critica no disponible',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
        },
      },
    },

    '/auth/email/start': {
      post: {
        operationId: 'authEmailStart',
        tags: ['Auth'],
        summary: 'Inicia verificacion de correo',
        requestBody: { required: true, content: json(EmailStartRequestSchema) },
        responses: {
          '202': { description: 'Respuesta anti-enumeracion', content: json(GenericAcceptedResponseSchema) },
          ...problemResponses,
        },
      },
    },
    '/auth/email/verify': {
      post: {
        operationId: 'authEmailVerify',
        tags: ['Auth'],
        summary: 'Consume token de verificacion',
        requestBody: { required: true, content: json(EmailVerifyRequestSchema) },
        responses: {
          '201': { description: 'Email verificado; se habilita enrolamiento TOTP', content: json(EmailVerifyResponseSchema) },
          ...problemResponses,
        },
      },
    },
    '/auth/totp/enroll': {
      post: {
        operationId: 'authTotpEnroll',
        tags: ['Auth'],
        summary: 'Genera secreto y QR para Google Authenticator',
        security: [{ authFlowCookie: [] }],
        responses: {
          '201': { description: 'TOTP pendiente de confirmar', content: json(TotpEnrollResponseSchema) },
          ...problemResponses,
        },
      },
    },
    '/auth/totp/confirm': {
      post: {
        operationId: 'authTotpConfirm',
        tags: ['Auth'],
        summary: 'Confirma TOTP y entrega recovery codes una sola vez',
        security: [{ authFlowCookie: [] }],
        requestBody: { required: true, content: json(TotpConfirmRequestSchema) },
        responses: {
          '201': { description: 'Identidad activada', content: json(RecoveryCodesResponseSchema) },
          ...problemResponses,
        },
      },
    },
    '/auth/login': {
      post: {
        operationId: 'authLogin',
        tags: ['Auth'],
        summary: 'Login mediante email + TOTP',
        requestBody: { required: true, content: json(LoginRequestSchema) },
        responses: {
          '201': { description: 'Sesion creada', content: json(SessionResponseSchema) },
          ...problemResponses,
        },
      },
    },
    '/auth/logout': {
      post: {
        operationId: 'authLogout',
        tags: ['Auth'],
        summary: 'Cierra sesion y revoca el trusted token local',
        security: [{ accessCookie: [] }],
        responses: {
          '200': { description: 'Sesion cerrada', content: json(SuccessResponseSchema) },
        },
      },
    },
    '/auth/session': {
      get: {
        operationId: 'authSession',
        tags: ['Auth'],
        summary: 'Obtiene sesion; puede restaurarla desde trusted device',
        responses: {
          '200': { description: 'Estado de sesion', content: json(SessionResponseSchema) },
        },
      },
    },
    '/auth/refresh': {
      post: {
        operationId: 'authRefresh', tags: ['Auth'],
        summary: 'Rota refresh token y emite un nuevo JWT de acceso',
        security: [{ refreshCookie: [] }],
        responses: { '201': { description: 'Tokens rotados', content: json(SessionResponseSchema) }, ...problemResponses },
      },
    },
    '/auth/recovery/email': {
      post: {
        operationId: 'authRecoveryEmail',
        tags: ['Auth'],
        summary: 'Solicita recuperacion por correo',
        requestBody: { required: true, content: json(RecoveryEmailRequestSchema) },
        responses: {
          '202': { description: 'Respuesta anti-enumeracion', content: json(GenericAcceptedResponseSchema) },
          ...problemResponses,
        },
      },
    },
    '/auth/recovery/email/verify': {
      post: {
        operationId: 'authRecoveryEmailVerify',
        tags: ['Auth'],
        summary: 'Consume token de recuperacion enviado por correo',
        requestBody: { required: true, content: json(RecoveryEmailVerifyRequestSchema) },
        responses: {
          '201': { description: 'Recuperacion autorizada', content: json(RecoveryReadyResponseSchema) },
          ...problemResponses,
        },
      },
    },
    '/auth/recovery/code': {
      post: {
        operationId: 'authRecoveryCode',
        tags: ['Auth'],
        summary: 'Usa un recovery code de un solo uso',
        requestBody: { required: true, content: json(RecoveryCodeRequestSchema) },
        responses: {
          '201': { description: 'Recuperacion autorizada', content: json(RecoveryReadyResponseSchema) },
          ...problemResponses,
        },
      },
    },
    '/auth/totp/rotate': {
      post: {
        operationId: 'authTotpRotate',
        tags: ['Auth'],
        summary: 'Valida TOTP actual y genera uno nuevo pendiente',
        security: [{ accessCookie: [] }],
        requestBody: { required: true, content: json(TotpRotateRequestSchema) },
        responses: {
          '201': { description: 'Nuevo TOTP pendiente', content: json(TotpEnrollResponseSchema) },
          ...problemResponses,
        },
      },
    },
    '/auth/totp/rotate/confirm': {
      post: {
        operationId: 'authTotpRotateConfirm',
        tags: ['Auth'],
        summary: 'Activa el TOTP nuevo y revoca trusted devices',
        security: [{ accessCookie: [] }],
        requestBody: { required: true, content: json(TotpRotateConfirmRequestSchema) },
        responses: {
          '201': { description: 'TOTP rotado', content: json(RecoveryCodesResponseSchema) },
          ...problemResponses,
        },
      },
    },
    '/auth/trusted-devices': {
      get: {
        operationId: 'authTrustedDevicesList',
        tags: ['Auth'],
        summary: 'Lista dispositivos recordados activos',
        security: [{ accessCookie: [] }],
        responses: {
          '200': { description: 'Dispositivos', content: json(TrustedDevicesResponseSchema) },
          ...problemResponses,
        },
      },
    },
    '/auth/trusted-devices/{deviceId}': {
      delete: {
        operationId: 'authTrustedDeviceRevoke',
        tags: ['Auth'],
        summary: 'Revoca un dispositivo',
        security: [{ accessCookie: [] }],
        requestParams: { path: DeviceIdParamsSchema },
        responses: {
          '200': { description: 'Dispositivo revocado', content: json(SuccessResponseSchema) },
          ...problemResponses,
        },
      },
    },
    '/auth/trusted-devices/revoke-all': {
      post: {
        operationId: 'authTrustedDevicesRevokeAll',
        tags: ['Auth'],
        summary: 'Revoca todos los dispositivos recordados',
        security: [{ accessCookie: [] }],
        responses: {
          '201': { description: 'Dispositivos revocados', content: json(SuccessResponseSchema) },
          ...problemResponses,
        },
      },
    },
    '/albums': {
      post: {
        operationId: 'albumCreate',
        tags: ['Albums'],
        summary: 'Crea un album y registra al creador como owner activo',
        security: [{ accessCookie: [] }],
        requestBody: { required: true, content: json(CreateAlbumInput) },
        responses: {
          '201': { description: 'Album creado', content: json(AlbumContract) },
          ...problemResponses,
        },
      },
      get: {
        operationId: 'albumListMine',
        tags: ['Albums'],
        summary: 'Lista albumes propios o con membresia activa',
        security: [{ accessCookie: [] }],
        responses: {
          '200': { description: 'Albumes accesibles', content: json(AlbumListResponseSchema) },
          ...problemResponses,
        },
      },
    },
    '/albums/{albumId}': {
      get: {
        operationId: 'albumGet',
        tags: ['Albums'],
        summary: 'Lee un album publico o un album privado accesible',
        requestParams: { path: AlbumIdParamsSchema },
        responses: {
          '200': { description: 'Album', content: json(AlbumContract) },
          '404': {
            description: 'Album inexistente o privado para la sesion',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '422': {
            description: 'Identificador invalido',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
        },
      },
      patch: {
        operationId: 'albumUpdate',
        tags: ['Albums'],
        summary: 'Actualiza un album; solo owner',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumIdParamsSchema },
        requestBody: { required: true, content: json(UpdateAlbumInput) },
        responses: {
          '200': { description: 'Album actualizado', content: json(AlbumContract) },
          '403': {
            description: 'Solo el owner puede modificar',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '404': {
            description: 'Album no encontrado',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
    },

  },
  components: {
    securitySchemes: {
      accessCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'irec_access',
      },
      refreshCookie: { type: 'apiKey', in: 'cookie', name: 'irec_refresh' },
      authFlowCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'irec_auth_flow',
      },
    },
  },
});
