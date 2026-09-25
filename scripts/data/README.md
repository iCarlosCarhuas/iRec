# iRec v0.3.0 — Data Safety

## DS-1 — Backup baseline

Acciones disponibles:

- `status`
- `backup`
- `list`
- `verify`

Los backups PostgreSQL usan:

- `pg_dump -Fc`
- SHA-256 obligatorio
- metadata JSON
- almacenamiento fuera del repositorio

Ruta por defecto:

`E:\MVP\iRec-data\backups\postgres\local`

Puede cambiarse con `IREC_DATA_HOME`.

---

## DS-2A — Restore test

Acción:

- `restore-test`

No modifica la base `irec`.

Valida el backup, crea una DB temporal, restaura el dump completo, verifica conectividad y tablas, y elimina únicamente esa DB temporal.

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass \
  -File ./scripts/data/irec-data.ps1 restore-test
```

---

## DS-2B — Safe Restore local

Acción:

- `restore`

### Importante

`restore` ES una operación destructiva sobre la base local `irec`.

El script protege el flujo con tres gates obligatorios:

1. restore completo previo en una DB temporal
2. backup de emergencia de la DB actual
3. confirmación humana exacta: `RESTORE IREC LOCAL`

Después:

- detiene Web y API si estaban ejecutándose
- termina conexiones activas
- recrea únicamente la DB `irec`
- restaura el dump seleccionado
- aplica migraciones pendientes mediante `irec-migrate`
- valida PostgreSQL
- vuelve a iniciar API/Web solo si todo salió correctamente

### Ejecución interactiva

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass \
  -File ./scripts/data/irec-data.ps1 restore \
  -BackupPath "E:\MVP\iRec-data\backups\postgres\local\irec-local-YYYYMMDDTHHMMSSZ.dump"
```

El script pedirá:

`RESTORE IREC LOCAL`

### Automatización controlada

Para pruebas automatizadas locales se puede pasar la frase:

```powershell
-Confirmation "RESTORE IREC LOCAL"
```

No usar esta opción en procedimientos manuales normales.

### Si falla un restore

No se ejecuta un restore secundario automáticamente.

API/Web permanecen detenidos y el script muestra el backup:

`irec-local-emergency-pre-restore-*.dump`

Así una persona puede revisar el estado antes de realizar otra operación destructiva.

### Este script NO ejecuta

- `docker compose down -v`
- `docker volume rm`
- `docker system prune --volumes`
- borrado silencioso de backups
- restore de producción

El mecanismo actual está limitado a LOCAL.
