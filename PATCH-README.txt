iRec v0.1.0 — Foundation Fix 2
==============================

Este ZIP es un parche DROP-IN.

Extraer su contenido directamente dentro de:

E:\MVP\iRec

permitiendo reemplazar los archivos existentes.

Corrige:

- apps/api/tsconfig.json
- apps/api/tsconfig.build.json
- scripts/verify-foundation.ps1
- documentación del hotfix

Después ejecutar desde Git Bash:

powershell.exe -ExecutionPolicy Bypass -File ./scripts/verify-foundation.ps1

Para validar sin levantar servidores:

powershell.exe -ExecutionPolicy Bypass -File ./scripts/verify-foundation.ps1 -SkipDev
