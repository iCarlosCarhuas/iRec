# Modelo de datos conceptual

## Entidades

### User
- id
- email
- emailVerifiedAt
- createdAt

### TotpCredential
- userId
- encryptedSecret
- activatedAt
- rotatedAt

### RecoveryCode
- id
- userId
- codeHash
- usedAt

### TrustedDevice
- id
- userId
- tokenHash
- expiresAt
- revokedAt

### StorageConnection
- id
- ownerId
- provider = R2
- label
- accountId
- bucket
- accessKeyIdEncrypted
- secretAccessKeyEncrypted
- endpoint
- lastVerifiedAt

### Album
- id
- ownerId
- storageConnectionId
- slug
- title
- description
- visibility = PUBLIC | PRIVATE
- editCodeHash
- themeId
- createdAt

### AlbumMember
- albumId
- userId
- role

### AlbumAsset
- id
- albumId
- submittedBy
- type
- provider
- objectKey
- mimeType
- width
- height
- status = PENDING | APPROVED | REJECTED
- capturedAt
- createdAt

### Theme
- id
- albumId
- manifest
- prompt
- model
- version
- createdAt

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

## Borrado de álbum

Transacción lógica:

1. bloquear edición;
2. enumerar objetos R2 del namespace del álbum;
3. eliminar R2;
4. eliminar metadatos dependientes;
5. registrar auditoría;
6. no eliminar videos YouTube salvo instrucción explícita.
