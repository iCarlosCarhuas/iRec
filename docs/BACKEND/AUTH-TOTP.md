# Plan de autenticación TOTP

## Alta

1. usuario aporta email;
2. backend envía enlace de un solo uso;
3. enlace confirma correo;
4. backend genera secreto TOTP;
5. se muestra URI `otpauth://` como QR;
6. usuario confirma código;
7. secreto pasa a estado activo;
8. recovery codes son emitidos.

## Login

- email;
- TOTP;
- rate limit por IP + identidad;
- protección ante enumeración;
- sesión segura.

## Rotación

1. sesión reciente;
2. desafío de recuperación/TOTP actual;
3. generar secreto nuevo;
4. confirmar TOTP nuevo;
5. revocar anterior de manera atómica.

## Recuperación

Orden preferente:

1. correo verificado;
2. recovery code.

Cloudflare R2 no participa en recuperación de identidad.
