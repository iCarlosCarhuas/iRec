# OpenAPI con Zod + Scalar

## Objetivo

La documentación de API será ejecutable y sincronizada con la validación real.

## Dependencias previstas

```bash
pnpm add zod zod-openapi
pnpm add @scalar/nestjs-api-reference
```

`zod-openapi` actual utiliza Zod 4 y puede generar OpenAPI 3.1.

## Organización backend

```text
apps/api/src/
├─ contracts/
│  ├─ auth.schemas.ts
│  ├─ album.schemas.ts
│  ├─ storage.schemas.ts
│  ├─ asset.schemas.ts
│  ├─ theme.schemas.ts
│  └─ youtube.schemas.ts
├─ openapi/
│  ├─ document.ts
│  └─ scalar.ts
└─ main.ts
```

## Ejemplo de schema

```ts
import * as z from 'zod';
import 'zod-openapi';

export const AlbumId = z
  .uuid()
  .meta({
    id: 'AlbumId',
    description: 'Identificador único del álbum',
    example: '0199f13c-4f11-7f30-a0f2-3b6ce5f0e123',
  });

export const CreateAlbumRequest = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).optional(),
    visibility: z.enum(['PUBLIC', 'PRIVATE']),
    storageConnectionId: z.uuid(),
  })
  .meta({ id: 'CreateAlbumRequest' });
```

## Documento

```ts
import { createDocument } from 'zod-openapi';

export const openApiDocument = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'iRec API',
    version: process.env.APP_VERSION ?? '0.1.0',
    description: 'API del álbum digital iRec',
  },
  servers: [
    { url: '/api', description: 'Current environment' },
  ],
  paths: {
    // Cada módulo registra operaciones usando sus Zod schemas.
  },
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'irec_session',
      },
    },
  },
});
```

## Endpoints de documentación

Backend debe exponer:

```text
GET /openapi.json
GET /reference
```

`/openapi.json` devuelve el documento generado.

Scalar consume ese endpoint:

```ts
import { apiReference } from '@scalar/nestjs-api-reference';

app.use(
  '/reference',
  apiReference({
    url: '/openapi.json',
    theme: 'default',
  }),
);
```

## Reglas contract-first

1. Request body/query/path/header tienen schema Zod.
2. Response relevante tiene schema.
3. Cada operación tiene `operationId`.
4. Cada operación tiene tags.
5. Errores comunes usan schemas reutilizables.
6. No documentar secretos reales en ejemplos.
7. No crear DTO de clase paralelo si no aporta valor.
8. OpenAPI generado se valida en CI.
9. Breaking change de contrato obliga revisión SemVer.
10. Scalar nunca es fuente de verdad: es renderer del OpenAPI.

## Tags previstos

- Auth
- Users
- Albums
- Storage
- Assets
- Moderation
- Themes
- YouTube
- Live
- Health

## Errores

Formato unificado:

```json
{
  "type": "https://irec.app/problems/validation-error",
  "title": "Validation error",
  "status": 422,
  "detail": "The request contains invalid fields",
  "requestId": "..."
}
```

Se recomienda RFC 9457 Problem Details.

## Seguridad de documentación

En producción:

- `/openapi.json` puede ser público si no revela topología sensible;
- Scalar no debe contener tokens por defecto;
- habilitar autorización interactiva solo donde resulte seguro;
- jamás precargar credenciales.
