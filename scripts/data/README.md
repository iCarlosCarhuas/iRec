# iRec v0.3.0 — Data Safety DS-1

Drop-in inicial para `chore/v030-data-safety`.

Incluye `status`, `backup`, `list` y `verify` para PostgreSQL local, usando `pg_dump -Fc`, SHA-256, metadata JSON y validación con `pg_restore -l`.

Los backups se guardan fuera del repositorio/worktree, por defecto en:

`E:\MVP\iRec-data\backups\postgres\local`

Puede sobrescribirse con `IREC_DATA_HOME`.

## Uso

```bash
cd /e/MVP/iRec-worktrees/data-safety
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./scripts/data/irec-data.ps1 status
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./scripts/data/irec-data.ps1 backup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./scripts/data/irec-data.ps1 list
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./scripts/data/irec-data.ps1 verify
```

## Seguridad

DS-1 no ejecuta `DROP DATABASE`, `TRUNCATE`, `DELETE`, `docker volume rm`, `docker compose down -v` ni operaciones de restore.

Todavía no incluye `restore`; eso se implementará en DS-2 con confirmación explícita y backup de emergencia previo.
