iRec v0.2.0 — TypeScript compatibility patch
=============================================

DROP-IN:
E:\MVP\iRec-worktrees\backend

Corrige:
- otplib 13 / timeStep narrowing
- jose 6 / KeyLike removido
- ioredis 6 / import TypeScript
- PostgreSQL host port oficial 15432
- .env.example y documentación de infraestructura

NO sobrescribe .env.

DESPUES DE EXTRAER:
1. pnpm install
2. pnpm typecheck
3. powershell.exe -ExecutionPolicy Bypass -File ./scripts/verify-identity-backend.ps1
