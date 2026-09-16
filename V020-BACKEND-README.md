# iRec v0.2.0 — Identity backend

Convención de recursos: `irec-*`.

## Aplicar

Extraer este proyecto/parche sobre:

```text
E:\MVP\iRec-worktrees\backend
```

## Si ya existía infraestructura `infra-*`

```bash
powershell.exe -ExecutionPolicy Bypass -File ./scripts/migrate-infra-naming.ps1
```

Luego:

```bash
powershell.exe -ExecutionPolicy Bypass -File ./scripts/init-local-env.ps1
pnpm install
pnpm dev:infra
pnpm db:push
powershell.exe -ExecutionPolicy Bypass -File ./scripts/verify-identity-backend.ps1
```

Infra esperada:

```text
irec-postgres
irec-redis
irec-mailpit
irec-network
```

Seguridad Identity:

- JWT RS256 access token;
- refresh rotation/reuse detection;
- recovery codes con bcrypt;
- secretos TOTP con AES-256-GCM;
- trusted device de 30 días.
