iRec v0.2.0 — HyperFrames accessibility fix
============================================

Corrige los errores reales reportados por:

  npx hyperframes check

Cambios:
- mejora contraste de textos pequeños;
- conserva runtime/layout/motion sin cambios;
- agrega script QA dedicado.

Aplicar sobre:
E:\MVP\iRec-worktrees\frontend

Validar:
  powershell.exe -ExecutionPolicy Bypass -File ./scripts/check-totp-hyperframes.ps1

El warning timeline_track_too_dense puede seguir apareciendo.
Es una advertencia de mantenibilidad, no un fallo de accesibilidad ni runtime.
