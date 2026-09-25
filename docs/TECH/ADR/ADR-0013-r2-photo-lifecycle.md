# ADR-0013 — R2 connection ownership and photo lifecycle

**Estado:** Accepted
**Fecha:** 2026-09-25
**Release objetivo:** `v0.4.0 — R2 + Photos`

## Context

ADR-0003 estableció BYO Cloudflare R2: cada creador utiliza almacenamiento de su
propia cuenta Cloudflare y iRec conserva únicamente la configuración necesaria
para operar contra ese bucket.

Album Core v0.3.0 ya introdujo owners, memberships, visibilidad y propuestas de
texto. v0.4.0 necesita añadir fotografías sin romper esos contratos ni convertir
`album_proposals` en una entidad polimórfica.

También existe un `CryptoService` server-side basado en AES-256-GCM que ya se usa
para secretos reversibles de Identity y puede reutilizarse para credenciales R2.

## Decision

### 1. Ownership de StorageConnection

`StorageConnection` pertenece al usuario/owner, no al álbum.

Una conexión puede reutilizarse por varios álbumes del mismo owner. El álbum
podrá asociarse de forma nullable a una conexión para mantener compatibles los
álbumes creados antes de v0.4.0.

Modelo conceptual:

```text
User 1 ---- N StorageConnection
StorageConnection 1 ---- N Album
```

### 2. Credenciales

Las credenciales reversibles se cifran server-side reutilizando el
`CryptoService` existente. No se introduce una segunda implementación
criptográfica en R2.

Nunca se envía Secret Access Key al navegador después de recibirla y nunca se
almacena en localStorage/sessionStorage.

### 3. Dominio Photo separado

Las fotografías se representan mediante `album_assets` y no mediante
`album_proposals`.

`album_proposals` permanece como workflow de propuestas textuales de v0.3.0.

Estado de moderación inicial para assets:

```text
pending
approved
rejected
```

### 4. Política de upload

- owner upload -> `approved`;
- active member upload -> `pending`;
- invited/removed member -> no upload;
- anonymous/guest upload -> fuera de v0.4.0;
- owner modera assets pendientes;
- public read solo expone assets `approved` cuando el álbum es público.

### 5. Data path

El upload normal usa URL prefirmada:

```text
browser -> Cloudflare R2
```

NestJS autoriza, genera el object key, emite el presign y posteriormente valida
el objeto/metadata. Los bytes completos de la imagen no atraviesan normalmente
el API.

### 6. Object keys

El backend controla el namespace:

```text
albums/{albumId}/originals/{assetId}.{ext}
albums/{albumId}/derived/{assetId}/thumb.webp
```

El cliente no puede escoger un prefijo u object key arbitrario.

## Alternatives considered

### Una conexión R2 por álbum

Rechazada porque duplica secretos y configuración cuando un owner utiliza el
mismo bucket para varios álbumes.

### Guardar fotos dentro de album_proposals

Rechazada porque acopla media con un dominio textual ya liberado y obligaría a
hacer nullable/polimórfico el contrato de proposals.

### Subir imágenes a través de NestJS

No es el flujo principal porque añade ancho de banda y memoria innecesarios al
API. Puede existir una excepción futura si alguna transformación server-side lo
requiere, pero no define v0.4.0.

### Bucket público obligatorio

Rechazado. El MVP puede mantener objetos privados y entregar acceso mediante
URLs prefirmadas de corta duración.

## Consequences

Positivas:

- preserva ownership del almacenamiento en el creator;
- evita duplicación de secretos;
- mantiene Album Core backward-compatible;
- separa media y proposals;
- reduce tráfico binario por NestJS;
- reutiliza seguridad existente.

Costos/obligaciones:

- R2 necesita CORS correcto para upload directo;
- los flujos presign/confirm deben manejar uploads abandonados;
- delete tiene side effects tanto en R2 como en PostgreSQL y requiere diseño
  explícito;
- las URLs de lectura deben tener expiración y autorización coherentes;
- cambios DB futuros requieren Data Safety gate antes de apply.

## Out of scope

Este ADR no define todavía:

- SQL/migración final;
- contratos HTTP definitivos;
- tiempos exactos de expiración de presigned URLs;
- multipart upload;
- guest upload;
- AI processing;
- video/live;
- estrategia avanzada de thumbnails.
