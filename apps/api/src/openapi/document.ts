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
  AlbumAssetContract,
  AlbumAssetParamsSchema,
  CompleteAlbumAssetUploadInput,
  AlbumAssetsResponseSchema,
  AlbumContract,
  AlbumIdParamsSchema,
  AlbumListResponseSchema,
  AlbumMemberParamsSchema,
  AlbumMemberViewContract,
  AlbumMembersResponseSchema,
  AlbumProposalParamsSchema,
  AlbumProposalViewContract,
  AlbumProposalsResponseSchema,
  AlbumStorageBindingContract,
  CreateAlbumInput,
  CreateAlbumProposalInput,
  InviteAlbumMemberInput,
  PresignAlbumAssetInput,
  PresignAlbumAssetResponseSchema,
  SetAlbumStorageConnectionInput,
  UpdateAlbumInput,
  CreateStorageConnectionInput,
  StorageConnectionContract,
  StorageConnectionIdParamsSchema,
  StorageConnectionsResponseSchema,
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
    { name: 'Photos', description: 'Photo asset metadata y moderacion' },
    { name: 'Storage', description: 'Cloudflare R2 BYO: conexiones y verificacion' },
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


    '/albums/{albumId}/members': {
      get: {
        operationId: 'albumMembersList',
        tags: ['Albums'],
        summary: 'Lista miembros; owner o miembro activo',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumIdParamsSchema },
        responses: {
          '200': { description: 'Membresias del album', content: json(AlbumMembersResponseSchema) },
          '404': {
            description: 'Album no encontrado o no accesible',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
    },
    '/albums/{albumId}/members/invite': {
      post: {
        operationId: 'albumMemberInvite',
        tags: ['Albums'],
        summary: 'Invita a un usuario registrado; solo owner',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumIdParamsSchema },
        requestBody: { required: true, content: json(InviteAlbumMemberInput) },
        responses: {
          '201': { description: 'Invitacion creada o ya pendiente', content: json(AlbumMemberViewContract) },
          '403': {
            description: 'Solo el owner puede invitar',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '409': {
            description: 'Usuario ya activo o conflicto de membresia',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
    },
    '/albums/{albumId}/members/accept': {
      post: {
        operationId: 'albumMemberAccept',
        tags: ['Albums'],
        summary: 'Acepta la invitacion de la sesion actual',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumIdParamsSchema },
        responses: {
          '200': { description: 'Membresia activada', content: json(AlbumMemberViewContract) },
          '404': {
            description: 'Invitacion no encontrada',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '409': {
            description: 'Invitacion no disponible',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
    },
    '/albums/{albumId}/members/{userId}': {
      delete: {
        operationId: 'albumMemberRemove',
        tags: ['Albums'],
        summary: 'Remueve una membresia; solo owner y nunca al owner',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumMemberParamsSchema },
        responses: {
          '200': { description: 'Membresia removida', content: json(SuccessResponseSchema) },
          '403': {
            description: 'Solo el owner puede remover miembros',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '404': {
            description: 'Membresia no encontrada',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
    },


    '/albums/{albumId}/proposals': {
      post: {
        operationId: 'albumProposalCreate',
        tags: ['Albums'],
        summary: 'Crea una propuesta; solo miembro activo distinto del owner',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumIdParamsSchema },
        requestBody: { required: true, content: json(CreateAlbumProposalInput) },
        responses: {
          '201': { description: 'Propuesta pendiente creada', content: json(AlbumProposalViewContract) },
          '403': {
            description: 'La sesion no puede proponer contenido',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '404': {
            description: 'Album privado no accesible',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
      get: {
        operationId: 'albumProposalList',
        tags: ['Albums'],
        summary: 'Lista propuestas y su estado; solo owner',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumIdParamsSchema },
        responses: {
          '200': { description: 'Propuestas del album', content: json(AlbumProposalsResponseSchema) },
          '403': {
            description: 'Solo el owner puede revisar propuestas',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '404': {
            description: 'Album no encontrado o no accesible',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
    },
    '/albums/{albumId}/proposals/{proposalId}/approve': {
      post: {
        operationId: 'albumProposalApprove',
        tags: ['Albums'],
        summary: 'Aprueba una propuesta pendiente; solo owner',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumProposalParamsSchema },
        responses: {
          '200': { description: 'Propuesta aprobada', content: json(AlbumProposalViewContract) },
          '403': {
            description: 'Solo el owner puede moderar',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '404': {
            description: 'Album o propuesta no encontrados',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '409': {
            description: 'La propuesta ya tiene una decision final distinta',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
    },
    '/albums/{albumId}/proposals/{proposalId}/reject': {
      post: {
        operationId: 'albumProposalReject',
        tags: ['Albums'],
        summary: 'Rechaza una propuesta pendiente; solo owner',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumProposalParamsSchema },
        responses: {
          '200': { description: 'Propuesta rechazada', content: json(AlbumProposalViewContract) },
          '403': {
            description: 'Solo el owner puede moderar',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '404': {
            description: 'Album o propuesta no encontrados',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '409': {
            description: 'La propuesta ya tiene una decision final distinta',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
    },



    '/albums/{albumId}/storage': {
      put: {
        operationId: 'albumStorageSet',
        tags: ['Albums', 'Storage'],
        summary: 'Asocia o desacopla una StorageConnection propia; solo owner',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumIdParamsSchema },
        requestBody: {
          required: true,
          content: json(SetAlbumStorageConnectionInput),
        },
        responses: {
          '200': {
            description: 'Storage del album actualizado',
            content: json(AlbumStorageBindingContract),
          },
          '403': {
            description: 'Solo el owner puede configurar storage',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '404': {
            description: 'Album o StorageConnection no encontrados',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
    },

    '/albums/{albumId}/assets': {
      get: {
        operationId: 'albumAssetList',
        tags: ['Photos'],
        summary: 'Lista metadata de fotos visibles para la sesion actual',
        requestParams: { path: AlbumIdParamsSchema },
        responses: {
          '200': { description: 'Assets visibles', content: json(AlbumAssetsResponseSchema) },
          '404': {
            description: 'Album no encontrado o no accesible',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
    },

    '/albums/{albumId}/assets/presign': {
      post: {
        operationId: 'albumAssetPresign',
        tags: ['Photos'],
        summary: 'Autoriza un PUT directo y reserva un asset id en Redis',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumIdParamsSchema },
        requestBody: {
          required: true,
          content: json(PresignAlbumAssetInput),
        },
        responses: {
          '200': {
            description: 'Presigned PUT de corta duracion',
            content: json(PresignAlbumAssetResponseSchema),
          },
          '403': {
            description: 'Uploader no autorizado',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '409': {
            description: 'Album sin storage configurado',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '502': {
            description: 'No se pudo generar la autorizacion R2',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
    },
    '/albums/{albumId}/assets/{assetId}/complete': {
      post: {
        operationId: 'albumAssetComplete',
        tags: ['Photos'],
        summary: 'Valida con HeadObject y registra metadata del upload',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumAssetParamsSchema },
        requestBody: {
          required: true,
          content: json(CompleteAlbumAssetUploadInput),
        },
        responses: {
          ...problemResponses,
          '200': {
            description: 'Upload validado y asset registrado',
            content: json(AlbumAssetContract),
          },
          '410': {
            description: 'Upload intent expirado o no corresponde',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '422': {
            description: 'Objeto ausente o metadata no coincide',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '502': {
            description: 'R2 no disponible para validar completion',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
        },
      },
    },

    '/albums/{albumId}/assets/{assetId}/approve': {
      post: {
        operationId: 'albumAssetApprove',
        tags: ['Photos'],
        summary: 'Aprueba un asset pending; solo owner',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumAssetParamsSchema },
        responses: {
          '200': { description: 'Asset aprobado', content: json(AlbumAssetContract) },
          '403': {
            description: 'Solo el owner puede moderar',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '404': {
            description: 'Album o asset no encontrados',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '409': {
            description: 'El asset ya tiene una decision final distinta',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
    },
    '/albums/{albumId}/assets/{assetId}/reject': {
      post: {
        operationId: 'albumAssetReject',
        tags: ['Photos'],
        summary: 'Rechaza un asset pending; solo owner',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumAssetParamsSchema },
        responses: {
          '200': { description: 'Asset rechazado', content: json(AlbumAssetContract) },
          '403': {
            description: 'Solo el owner puede moderar',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '404': {
            description: 'Album o asset no encontrados',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '409': {
            description: 'El asset ya tiene una decision final distinta',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
    },

    '/storage-connections': {
      post: {
        operationId: 'storageConnectionCreate',
        tags: ['Storage'],
        summary: 'Valida R2 y guarda una conexion cifrada solo si la verificacion pasa',
        security: [{ accessCookie: [] }],
        requestBody: { required: true, content: json(CreateStorageConnectionInput) },
        responses: {
          '201': { description: 'Conexion R2 verificada y guardada', content: json(StorageConnectionContract) },
          '409': {
            description: 'Ya existe una conexion para esa cuenta y bucket',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '502': {
            description: 'Cloudflare R2 no disponible o timeout',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
      get: {
        operationId: 'storageConnectionList',
        tags: ['Storage'],
        summary: 'Lista conexiones R2 propias sin exponer credenciales',
        security: [{ accessCookie: [] }],
        responses: {
          '200': { description: 'Conexiones del owner actual', content: json(StorageConnectionsResponseSchema) },
          ...problemResponses,
        },
      },
    },
    '/storage-connections/{connectionId}/test': {
      post: {
        operationId: 'storageConnectionTest',
        tags: ['Storage'],
        summary: 'Vuelve a validar una conexion R2 propia y actualiza lastVerifiedAt',
        security: [{ accessCookie: [] }],
        requestParams: { path: StorageConnectionIdParamsSchema },
        responses: {
          '200': { description: 'Conexion R2 validada nuevamente', content: json(StorageConnectionContract) },
          '404': {
            description: 'Conexion inexistente o de otro owner',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '502': {
            description: 'Cloudflare R2 no disponible o timeout',
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
