# iRec v0.2.0 — HyperFrames TOTP v2

## Cambio solicitado

1. Tutorial más preciso.
2. Video dentro de la misma ruta `/auth/totp/setup`.
3. Camino principal basado en Google Authenticator.
4. Variante explícita para Microsoft Authenticator.
5. Continuidad exacta hasta `Activar TOTP` y recovery codes.

## Aplicar

Extraer sobre:

```text
E:\MVP\iRec-worktrees\frontend
```

## Validar

```bash
pnpm --filter @irec/web typecheck
pnpm --filter @irec/web build
powershell.exe -ExecutionPolicy Bypass -File ./scripts/check-totp-hyperframes.ps1
```

Después:

```text
http://127.0.0.1:4200/auth/totp/setup
```

Abrir `Ver paso a paso` y luego `Ver tutorial animado · HyperFrames`.
El reproductor aparecerá debajo, sin abandonar la ruta.
