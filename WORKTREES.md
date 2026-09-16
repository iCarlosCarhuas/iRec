# Worktrees iRec

```text
E:\MVP\iRec                    → main
E:\MVP\iRec-worktrees\backend  → feat/backend
E:\MVP\iRec-worktrees\frontend → feat/frontend
E:\MVP\iRec-worktrees\docs     → docs/project
E:\MVP\iRec-worktrees\v0.2.0   → integration/v0.2.0
```

Los worktrees comparten el mismo repositorio Git pero cada uno tiene su propio
working tree y branch checked out.

`integration/v0.2.0` es el lugar donde backend, frontend y docs se encuentran
y donde se ejecutan Docker/E2E antes del merge a `main`.

Ver `docs/TECH/WORKTREES.md` y `docs/TECH/INTEGRATION-V020.md`.
