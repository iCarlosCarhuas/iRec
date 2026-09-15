# Autenticación TOTP

## Alta

1. usuario aporta email;
2. backend inicia verificación sin revelar si existe;
3. enlace/token confirma correo;
4. se crea auth flow temporal;
5. backend genera secreto TOTP;
6. se muestra QR;
7. usuario confirma código;
8. credencial queda activa;
9. se emiten 10 recovery codes;
10. se emite JWT access + refresh;
11. opcionalmente se registra trusted device.

## Login

- email;
- TOTP;
- rate limit por IP + cuenta;
- replay protection;
- JWT access en cookie HttpOnly;
- refresh opaco rotativo;
- trusted device opcional.

## Rotación

1. sesión válida;
2. TOTP actual;
3. secreto nuevo;
4. confirmación del nuevo TOTP;
5. sustitución de secreto;
6. recuperación regenerada;
7. trusted devices revocados.

## Recuperación

Alternativas:

1. correo verificado;
2. recovery code.

La recuperación abre un auth flow y obliga a enrolar un TOTP nuevo.

Cloudflare R2 no participa en identidad.
