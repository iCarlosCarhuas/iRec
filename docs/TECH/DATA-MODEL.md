# Modelo de datos

## Implementado en v0.2.0

### `users`
- id
- email
- emailVerifiedAt
- createdAt
- updatedAt

### `email_tokens`
- tokens de verificación/recuperación;
- hash del token;
- propósito;
- expiración;
- consumo;
- relación con usuario cuando aplica.

### `totp_credentials`
- userId
- secretEncrypted
- pendingSecretEncrypted cuando rota/enrola
- lastTimeStep
- activatedAt
- updatedAt

### `recovery_codes`
- id
- userId
- codeHash (bcrypt)
- usedAt
- createdAt

### `trusted_devices`
- id
- userId
- tokenHash
- userAgent
- expiresAt
- revokedAt
- createdAt / lastUsedAt

## Estado temporal en Redis

No forma parte del esquema PostgreSQL:

- auth flows;
- refresh token state;
- refresh families;
- refresh-used markers;
- access `jti` revocados;
- rate limit counters.

## Entidades previstas en siguientes versiones

### StorageConnection
- ownerId
- provider = R2
- accountId
- bucket
- accessKeyIdEncrypted
- secretAccessKeyEncrypted
- endpoint
- lastVerifiedAt

### Album
- ownerId
- storageConnectionId
- slug
- title
- description
- visibility
- editCodeHash
- themeId

### AlbumMember
- albumId
- userId
- role

### AlbumAsset
- albumId
- submittedBy
- type
- provider
- objectKey
- status = PENDING | APPROVED | REJECTED

### Theme
- albumId
- manifest
- prompt
- model
- version

### YouTubeConnection
- ownerId
- encryptedRefreshToken
- channelId
- scopes

### VideoAsset
- albumId
- youtubeVideoId
- privacyStatus
- liveBroadcastId
- status

## Borrado futuro de álbum

1. bloquear edición;
2. enumerar objetos R2 del namespace;
3. eliminar R2;
4. eliminar metadatos dependientes;
5. registrar auditoría;
6. no eliminar YouTube salvo confirmación expresa.
