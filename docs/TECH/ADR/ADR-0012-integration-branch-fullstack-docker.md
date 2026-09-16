# ADR-0012 — Integration branch por release + full-stack Docker local

**Estado:** Accepted  
**Fecha:** 2026-09-16

## Contexto

Durante `v0.2.0`, backend, frontend y documentación evolucionaron en worktrees
separados. Esto protege `main`, pero produjo una dificultad operativa válida:
ningún worktree de feature representa por sí solo el sistema completo.

Además, levantar iRec requiere hoy conocer varios comandos y distinguir qué
servicios se ejecutan en host y cuáles en Docker.

## Decisión

### 1. Rama de integración por release

Antes del E2E final se crea:

```text
integration/vX.Y.Z
```

con su worktree:

```text
E:\MVP\iRec-worktrees\vX.Y.Z
```

El candidato integra las ramas de feature/docs y se valida antes de `main`.

### 2. `main` sigue siendo estable

`main` no se usa como espacio de ensamblaje provisional. Solo recibe el release
candidate después de todos los gates.

### 3. Full-stack Docker como entrada reproducible

Cada candidato debe poder levantar el sistema completo mediante un compose de
raíz:

```bash
docker compose up --build -d
```

El compose de dependencias `infra/docker-compose.dev.yml` se conserva para
desarrollo híbrido.

### 4. Los worktrees no son requisito para consumir el producto

Un colaborador puede usar worktrees para desarrollar, pero una persona que
solo necesita ejecutar el release debe poder clonar `main` y usar Docker.

## Consecuencias positivas

- `main` conserva un significado claro;
- E2E se ejecuta sobre el mismo árbol que se propone liberar;
- Docker reduce conocimiento tribal;
- los worktrees mantienen aislamiento de desarrollo;
- los conflictos se resuelven antes del PR final;
- un clon limpio puede reproducir el sistema.

## Costos

- aparece una rama/worktree adicional durante cada release;
- hay que mantener Dockerfiles y compose;
- el gate tarda más porque valida integración completa;
- deben distinguirse claramente el modo híbrido y el modo full-stack.

## Alternativas descartadas

### Mergear features directamente a main

Reduce pasos, pero convierte `main` en ambiente de integración y puede dejar
un estado parcialmente funcional.

### Ejecutar todo siempre desde worktrees separados

Funciona para desarrollo, pero complica onboarding, E2E y reproducción.

### Copiar archivos/ZIPs a un árbol común

Pierde semántica de Git, puede sobreescribir cambios de otra rama y hace muy
difícil auditar el release.

## Implementación v0.2.0

La decisión se materializa mediante:

```text
compose.yaml
apps/api/Dockerfile
apps/web/Dockerfile
apps/web/nginx.conf
scripts/generate-docker-env.mjs
scripts/irec.ps1
scripts/verify-fullstack-docker.ps1
```

El código está preparado en el candidato; la aceptación definitiva del ADR
para release depende de pasar el gate Docker runtime y el E2E Identity.
