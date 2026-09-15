# iRec worktrees

Después de extraer el proyecto en `E:\MVP\iRec`, ejecuta:

```powershell
cd E:\MVP\iRec
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup-worktrees.ps1
```

Resultado:

```text
E:\MVP\iRec                         main
E:\MVP\iRec-worktrees\frontend      feat/frontend
E:\MVP\iRec-worktrees\backend       feat/backend
E:\MVP\iRec-worktrees\docs          docs/project
```

Consulta `docs/TECH/WORKTREES.md` para el flujo completo.
