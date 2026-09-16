# iRec v0.2.0 — guía TOTP + HyperFrames

Aplicar sobre:

```text
E:\MVP\iRec-worktrees\frontend
```

## Qué agrega

En `/auth/totp/setup`:

- bloque “¿No tienes una app de autenticación?”;
- guía de 5 pasos;
- instrucciones para Google Authenticator y alternativas TOTP;
- explicación de escaneo QR / clave manual;
- recordatorio de que el código cambia aproximadamente cada 30 s;
- enlace a un tutorial animado HyperFrames.

HyperFrames:

```text
apps/web/public/tutorials/totp-onboarding/
├─ index.html
├─ player.html
├─ meta.json
└─ README.md
```

El tutorial es deliberadamente ficticio y nunca consume el QR real del usuario.

## Validar frontend

Con backend activo:

```bash
cd /e/MVP/iRec-worktrees/frontend
pnpm --filter @irec/web typecheck
pnpm --filter @irec/web build
```

Después recarga:

```text
http://127.0.0.1:4200/auth/totp/setup
```

## Preview HyperFrames

Opcional:

```bash
powershell.exe -ExecutionPolicy Bypass -File ./scripts/preview-totp-hyperframes.ps1
```

Esto usa `npx hyperframes`, por lo que requiere acceso a npm.
