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
  StorageConnectionContract,
  StorageConnectionIdParamsSchema,
  StorageConnectionsResponseSchema,
  TotpConfirmRequestSchema,
  TotpEnrollResponseSchema,
  TotpRotateConfirmRequestSchema,
  TotpRotateRequestSchema,
  TrustedDevicesResponseSchema,
} from '@irec/contracts';
import {
  AlbumAssetContract,
  AlbumAssetParamsSchema,
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
  CreateAlbumAssetInput,
  CreateAlbumInput,
  CreateAlbumProposalInput,
  InviteAlbumMemberInput,
  UpdateAlbumInput,
  UploadAlbumAssetMultipartSchema,
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
    { name: 'Storage', description: 'User-owned storage connections' },
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

    '/albums/{albumId}/assets': {
      post: {
        operationId: 'albumAssetCreate',
        tags: ['Albums'],
        summary: 'Registra un contenido pendiente con una conexion propia verificada',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumIdParamsSchema },
        requestBody: { required: true, content: json(CreateAlbumAssetInput) },
        responses: {
          '201': { description: 'Contenido pendiente creado', content: json(AlbumAssetContract) },
          '403': {
            description: 'La sesion no es miembro del album',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '404': {
            description: 'Album inexistente o conexion ajena/inexistente',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '409': {
            description: 'La conexion no esta verificada',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
      get: {
        operationId: 'albumAssetList',
        tags: ['Albums'],
        summary: 'Lista contenidos no eliminados; albumes privados ocultos con 404',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumIdParamsSchema },
        responses: {
          '200': { description: 'Contenidos del album', content: json(AlbumAssetsResponseSchema) },
          '404': {
            description: 'Album inexistente o privado para la sesion',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
    },
    '/albums/{albumId}/assets/upload': {
      post: {
        operationId: 'albumAssetUpload',
        tags: ['Albums'],
        summary: 'Sube bytes a Drive con sesion reanudable y finaliza tras verificar',
        description: 'multipart/form-data con storageConnectionId y sizeBytes como campos de texto (antes del archivo) y los bytes en la parte `file` (jpeg/png/webp/mp4, <= 100MB). Crea el contenido en pendiente, transmite a Google sin cargarlo completo en memoria, verifica id/tamano/mime en el proveedor y solo entonces lo marca listo. Un fallo del proveedor deja el contenido en fallido (failed).',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumIdParamsSchema },
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': { schema: UploadAlbumAssetMultipartSchema },
          },
        },
        responses: {
          '201': { description: 'Contenido listo y verificado', content: json(AlbumAssetContract) },
          '403': {
            description: 'La sesion no es miembro del album o Drive no permite escribir',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '404': {
            description: 'Album inexistente o conexion ajena/inexistente',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '502': {
            description: 'El proveedor fallo o devolvio una respuesta invalida',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
    },
    '/albums/{albumId}/assets/{assetId}': {
      get: {
        operationId: 'albumAssetGet',
        tags: ['Albums'],
        summary: 'Lee un contenido por id; respeta la visibilidad del album',
        description: 'Mismos permisos que la lista: albumes privados ocultos con 404. Siempre incluye storageConnectionId y providerFileId para galerias multi-Drive. Sin bytes.',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumAssetParamsSchema },
        responses: {
          '200': { description: 'Contenido con su conexion y archivo proveedor', content: json(AlbumAssetContract) },
          '404': {
            description: 'Album privado/inexistente o contenido eliminado/ajeno',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
      delete: {
        operationId: 'albumAssetDelete',
        tags: ['Albums'],
        summary: 'Elimina en Drive y marca local como eliminado; owner o quien lo subio, idempotente',
        description: 'Autoriza primero (owner o quien subio + membresia), elimina el archivo en Drive y luego finaliza la fila local. Un archivo ya ausente en el proveedor igual finaliza local; cualquier otro fallo del proveedor deja la fila intacta con un 502 sanitizado.',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumAssetParamsSchema },
        responses: {
          '200': { description: 'Contenido eliminado', content: json(SuccessResponseSchema) },
          '403': {
            description: 'Solo el owner o quien subio el contenido puede eliminarlo',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '404': {
            description: 'Album o contenido no encontrados en este album',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '502': {
            description: 'El proveedor no pudo eliminar; la fila local conserva su estado',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
    },
    '/albums/{albumId}/assets/{assetId}/content': {
      get: {
        operationId: 'albumAssetContent',
        tags: ['Albums'],
        summary: 'Transmite los bytes del contenido desde Drive (proxy seguro)',
        description: 'Autoriza visibilidad + membresia + pertenencia y luego transmite desde la conexion Drive propia del contenido (multi-Drive correcto). El archivo Drive nunca se hace publico y no se emiten URL con tokens. Responde image/jpeg, image/png, image/webp o video/mp4 con Accept-Ranges: bytes; un encabezado Range de un solo rango devuelve 206 + Content-Range para video, o 416 si es insatisfacible. Content-Disposition: inline.',
        security: [{ accessCookie: [] }],
        requestParams: { path: AlbumAssetParamsSchema },
        responses: {
          '200': { description: 'Bytes completos del contenido' },
          '206': { description: 'Rango parcial de bytes (video seeking)' },
          '404': {
            description: 'Album privado/inexistente o contenido eliminado/ajeno',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '409': {
            description: 'El contenido aun no esta listo o la conexion no esta verificada',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '416': {
            description: 'Rango fuera del contenido',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          '502': {
            description: 'El proveedor fallo o devolvio bytes que no coinciden con el registro',
            content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
          },
          ...problemResponses,
        },
      },
    },

    '/storage/connections': {
      get: {
        operationId: 'storageConnectionsList',
        tags: ['Storage'],
        summary: 'List connections owned by the current session',
        description: 'Stored status and last successful verification only; ready is not proof of current provider health, including after a failed prepare.',
        security: [{ accessCookie: [] }],
        responses: {
          '200': { description: 'Owned connections without credentials or provider identifiers', content: json(StorageConnectionsResponseSchema) },
          ...problemResponses,
        },
      },
    },
    '/storage/connections/{connectionId}/prepare': {
      post: {
        operationId: 'storageConnectionPrepare',
        tags: ['Storage'],
        summary: 'Verify or prepare the owned Google Drive root',
        description: 'Revalidates the provider even for stored ready connections. Provider work has a shared 30-second deadline. Failure does not certify health or replace historical stored status.',
        security: [{ accessCookie: [] }],
        requestParams: { path: StorageConnectionIdParamsSchema },
        responses: {
          '200': { description: 'Connection successfully verified without credentials or provider identifiers', content: json(StorageConnectionContract) },
          '403': { description: 'Google Drive permissions do not allow writing', content: { 'application/problem+json': { schema: ProblemDetailsSchema } } },
          '404': { description: 'Connection absent, not owned or not Google Drive', content: { 'application/problem+json': { schema: ProblemDetailsSchema } } },
          '502': { description: 'Invalid provider response', content: { 'application/problem+json': { schema: ProblemDetailsSchema } } },
          '503': { description: 'Provider unavailable, deadline exceeded or preparation failed', content: { 'application/problem+json': { schema: ProblemDetailsSchema } } },
          ...problemResponses,
        },
      },
    },

    '/storage/google/connect': {
      get: {
        operationId: 'googleDriveConnect',
        tags: ['Storage'],
        summary: 'Inicia conexion OAuth con Google Drive',
        security: [{ accessCookie: [] }],
        responses: {
          '302': {
            description: 'Redireccion a Google OAuth',
          },
          '401': {
            description: 'No autenticado',
            content: {
              'application/problem+json': {
                schema: ProblemDetailsSchema,
              },
            },
          },
          '503': {
            description: 'Google OAuth no configurado',
            content: {
              'application/problem+json': {
                schema: ProblemDetailsSchema,
              },
            },
          },
        },
      },
    },

    '/storage/google/callback': {
      get: {
        operationId: 'googleDriveCallback',
        tags: ['Storage'],
        summary: 'Completa conexion OAuth con Google Drive',
        description: 'On success, redirects only to /settings/storage on the configured PUBLIC_WEB_URL. No request host, redirect input, OAuth code, state, token or connection data is included in the redirect. Failures remain sanitized problem responses; state is single-use and session-owner-bound.',
        security: [{ accessCookie: [] }],
        responses: {
          '302': {
            description: 'Conexion Google Drive creada o actualizada; redireccion fija a almacenamiento',
            headers: {
              Location: {
                description: 'Configured public web origin plus /settings/storage; no query or fragment.',
                schema: { type: 'string', format: 'uri' },
              },
            },
          },
          '400': {
            description: 'Callback invalido, expirado o cancelado',
            content: {
              'application/problem+json': {
                schema: ProblemDetailsSchema,
              },
            },
          },
          '401': {
            description: 'No autenticado',
            content: {
              'application/problem+json': {
                schema: ProblemDetailsSchema,
              },
            },
          },
          '503': {
            description: 'Google OAuth o URL publica de iRec no configurados',
            content: {
              'application/problem+json': {
                schema: ProblemDetailsSchema,
              },
            },
          },
          '502': {
            description: 'Google OAuth o Drive no disponible',
            content: {
              'application/problem+json': {
                schema: ProblemDetailsSchema,
              },
            },
          },
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
