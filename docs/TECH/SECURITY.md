# Seguridad

## Identidad

Autenticación principal:

```text
email verificado + TOTP
```

No existe contraseña tradicional.

## TOTP

- secreto generado con CSPRNG;
- QR solo durante enrolamiento/reemplazo;
- secreto cifrado en reposo;
- validación con ventana temporal limitada;
- protección contra replay cuando corresponda;
- regenerar TOTP invalida el secreto anterior.

## Recovery codes

- generados aleatoriamente;
- mostrados una sola vez;
- almacenados solo como hashes;
- cada código es de un solo uso;
- regenerar recovery codes invalida el set previo.

## Trusted devices

- máximo 30 días;
- token independiente del TOTP;
- cookie `HttpOnly`, `Secure`, `SameSite`;
- revocable;
- fingerprinting invasivo prohibido.

## R2

Credenciales del propietario:

- nunca expuestas al navegador;
- cifradas mediante una master key del servidor/KMS;
- permisos mínimos;
- preferencia por bucket dedicado;
- presigned URL de corta vida para upload/download.

## YouTube

- OAuth 2.0;
- scopes mínimos;
- refresh token cifrado;
- revocación disponible;
- nunca registrar tokens en logs.

## Modo edición

El código de edición es defensa adicional de UX, no autorización primaria.

Backend siempre exige:

```text
authenticated user === album.owner
```

## API

- rate limit en auth;
- CSRF según modelo de sesión;
- CORS explícito;
- headers seguros;
- validación Zod en toda entrada;
- límites de tamaño;
- IDs no secuenciales;
- auditoría de operaciones sensibles.

## IA

- el modelo no ejecuta HTML/JS arbitrario;
- solo genera un `ThemeManifest` validado;
- sanitización de texto;
- rechazo de URLs o componentes fuera de allowlist.
