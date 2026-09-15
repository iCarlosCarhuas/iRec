# Seguridad

## Identidad

Autenticación principal:

```text
email verificado + TOTP
```

No existe contraseña tradicional.

## Modelo de sesión

### Access token

- JWT RS256;
- TTL local actual: 15 minutos;
- `iss=irec`;
- `aud=irec-web`;
- `sub=userId`;
- `jti` único;
- cookie `irec_access`;
- HttpOnly;
- SameSite=Lax;
- Secure en producción;
- revocación de `jti` restante en Redis cuando aplica.

No se almacena en `localStorage` ni `sessionStorage`.

### Refresh token

- opaco y CSPRNG;
- TTL local actual: 12 horas;
- cookie `irec_refresh`;
- solo su SHA-256 se usa como clave de estado;
- rotación en cada uso;
- tokens consumidos se marcan para detectar reuso;
- reuso provoca revocación de la familia.

### Trusted device

- token separado de access/refresh;
- cookie `irec_trusted`;
- máximo 30 días;
- revocable individualmente o en bloque;
- sin fingerprinting invasivo.

## TOTP

- SHA-1;
- 6 dígitos;
- 30 segundos;
- tolerancia ±1 timestep;
- secreto generado con CSPRNG;
- QR solo en enrolamiento/rotación;
- secreto cifrado con AES-256-GCM;
- replay protection mediante `lastTimeStep`;
- rotar invalida el secreto anterior.

## Recovery codes

- 10 códigos;
- formato humano con prefijo `IREC-`;
- mostrados una sola vez;
- un solo uso;
- hash bcrypt cost 12;
- regenerar/rotar invalida el set anterior.

bcrypt se usa para secretos introducidos por personas. Tokens aleatorios de alta
entropía usan SHA-256 para lookup eficiente, no bcrypt.

## Email y recuperación

- tokens aleatorios de alta entropía;
- expiración corta;
- respuestas anti-enumeración;
- rate limits por IP y cuenta;
- Cloudflare R2 no participa en recuperación de identidad.

## Secretos reversibles

Se cifran con AES-256-GCM cuando la aplicación necesita recuperarlos:

- TOTP secret;
- R2 secret key (v0.4);
- YouTube OAuth refresh token (v0.6).

## R2

- credenciales nunca al navegador;
- permisos mínimos;
- bucket dedicado recomendado;
- presigned URLs de vida corta.

## YouTube

- OAuth 2.0;
- scopes mínimos;
- refresh token cifrado;
- tokens ausentes de logs.

## API

- rate limit en auth;
- CORS explícito;
- cookies HttpOnly;
- SameSite=Lax;
- Secure en producción;
- validación Zod;
- IDs no secuenciales;
- límites de tamaño;
- auditoría futura de operaciones sensibles.

## IA

El modelo no ejecuta HTML/JS arbitrario. Solo genera un `ThemeManifest`
validado y renderizado mediante componentes allowlisted.
