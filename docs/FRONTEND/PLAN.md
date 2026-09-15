# Plan Frontend

## Estado actual

`v0.2.0 Identity` backend ya está listo. El siguiente gate es frontend.

## Gate Identity frontend

Pantallas/rutas:

```text
/auth
/auth/verify-email
/auth/totp/setup
/auth/recovery-codes
/auth/recover
/settings/security
```

## Reglas Identity

- no guardar access/refresh en localStorage;
- usar cookies HttpOnly gestionadas por backend;
- requests con credentials;
- restaurar estado mediante `/api/auth/session`;
- recovery codes deben mostrarse claramente una sola vez;
- permitir copiar/descargar recovery codes;
- `rememberDevice` es explícito;
- estados de error no deben facilitar enumeración;
- settings permite listar/revocar trusted devices;
- rotación TOTP debe advertir que revoca el anterior.

## Estructura

```text
app/
├─ core/
│  ├─ auth/
│  ├─ api/
│  ├─ guards/
│  └─ storage/
├─ features/
│  ├─ auth/
│  ├─ dashboard/
│  ├─ albums/
│  ├─ uploads/
│  ├─ moderation/
│  ├─ themes/
│  ├─ youtube/
│  └─ live/
└─ shared/
```

## PWA

- installable;
- app shell cacheable;
- no cachear secretos;
- estados offline explícitos.

## Contrato

Frontend no inventa DTOs divergentes.
Debe usar `@irec/contracts` y/o contrato generado desde OpenAPI.

## Después de Identity

Dashboard/Album Core inicia en `v0.3.0`, no antes de cerrar `v0.2.0`.
