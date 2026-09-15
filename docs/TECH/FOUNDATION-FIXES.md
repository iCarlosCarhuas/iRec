# v0.1.0 Foundation stabilization

Esta revisión incorpora problemas encontrados durante la primera instalación real en Windows/Git Bash.

## PNPM build policy

pnpm v12 bloquea scripts de instalación de dependencias no aprobadas.

iRec versiona explícitamente:

```yaml
allowBuilds:
  "@parcel/watcher": true
  esbuild: true
  lmdb: true
  msgpackr-extract: true
```

Por lo tanto una instalación limpia no debería requerir ejecutar manualmente
`pnpm approve-builds` para el grafo actual.

Si una futura dependencia introduce un nuevo build script, pnpm debe volver a
bloquearlo hasta que sea revisado. No se habilita un permiso global.

## TypeScript 6

`baseUrl` fue eliminado de `apps/api/tsconfig.json`. El workspace no lo necesita:
`@irec/contracts` se resuelve como paquete `workspace:*`.

No se usa `ignoreDeprecations` para ocultar el problema.

## Validación requerida

```bash
pnpm install
pnpm typecheck
pnpm openapi:check
pnpm build
pnpm dev
```

La v0.1.0 no se considera cerrada hasta que estos pasos pasen en el entorno Windows objetivo.
