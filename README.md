# iRec

> PWA de álbumes digitales temáticos para conservar, organizar y compartir recuerdos.

## Estado actual

```text
v0.1.0  Foundation  ✅ publicado en main
v0.2.0  Identity    🚧 candidato en integración
```

`main` todavía representa la versión estable `v0.1.0`. El trabajo de `v0.2.0`
está separado en tres ramas/worktrees y **ninguna de ellas, por sí sola,
representa el producto completo**:

```text
feat/backend   → Identity backend + DB + Redis + Mailpit + contratos
feat/frontend  → Identity UI + TOTP + recovery + trusted devices + HyperFrames
docs/project   → documentación, ADRs, changelogs y estado
```

La siguiente etapa crea un candidato completo:

```text
integration/v0.2.0
```

Ahí se integran las tres ramas, se implementa/valida el arranque full-stack con
Docker, se ejecuta el E2E de Identity y recién después se propone el merge a
`main` y el tag `v0.2.0`.

## ¿Qué carpeta uso?

```text
E:\MVP\iRec                         → main estable
E:\MVP\iRec-worktrees\backend       → feat/backend
E:\MVP\iRec-worktrees\frontend      → feat/frontend
E:\MVP\iRec-worktrees\docs          → docs/project
E:\MVP\iRec-worktrees\v0.2.0        → integration/v0.2.0 (candidato)
```

Para entender el flujo completo:

- `WORKTREE-QUICKSTART.txt` — mapa rápido.
- `WORKTREES.md` — explicación corta de worktrees.
- `docs/PROJECT-STATE.md` — estado real del release.
- `docs/TECH/WORKTREES.md` — estrategia detallada.
- `docs/TECH/INTEGRATION-V020.md` — integración actual de v0.2.0.
- `docs/TECH/FULLSTACK-DOCKER.md` — ejecución completa con Docker.
- `docs/TECH/RELEASE-V020-CHECKLIST.md` — checklist hasta el tag.

## Arquitectura del MVP

```text
Angular PWA
    │
    ▼
NestJS API
    │
    ├── PostgreSQL
    ├── Redis
    └── Email (Mailpit local / Resend producción)

Próximas fases:
Cloudflare R2 BYO Storage · IA ThemeManifest · YouTube/Live
```

### API y documentación

```text
Zod schemas
   ↓
zod-openapi
   ↓
OpenAPI 3.1
   ↓
Scalar
```

Cuando la API está levantada:

```text
API       http://127.0.0.1:3000
OpenAPI   http://127.0.0.1:3000/openapi.json
Scalar    http://127.0.0.1:3000/reference
```

Scalar documenta el **contrato HTTP de la API**. La guía para clonar,
integrar ramas, usar worktrees o levantar Docker vive en el repositorio y no se
duplica dentro de Scalar.

## Requisitos de desarrollo

- Node.js `>= 24.15.0`
- pnpm `12.4.1`
- Git
- Docker + Docker Compose

## Regla de release

No se desarrolla directamente sobre `main` y no se etiqueta `v0.2.0` hasta
que el candidato integrado haya pasado:

```text
backend gate
frontend gate
HyperFrames QA
full-stack Docker gate
E2E Identity
final gate
```
