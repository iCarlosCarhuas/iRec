# Versionado y control de cambios

iRec usa Semantic Versioning:

- `MAJOR`: incompatibilidad;
- `MINOR`: funcionalidad nueva compatible;
- `PATCH`: corrección compatible.

## Baseline / work in progress

```text
v0.1.0  Foundation         released
v0.2.0  Identity           in progress
```

Un gate de un worktree no crea una release.

`v0.2.0` se etiqueta únicamente después de:

1. backend;
2. frontend;
3. E2E;
4. docs;
5. merge a `main`;
6. gate final desde `main`.

## Dos changelogs, una versión

### TECH
Arquitectura, API, DB, seguridad, infraestructura, dependencias.

### NONTECH
Comportamiento visible, UX, alcance y decisiones de producto.

## Pull requests / commits

Cada integración debe revisar:

```text
Docs impact:
- [ ] TECH changelog
- [ ] NONTECH changelog
- [ ] OpenAPI
- [ ] ADR
- [ ] Frontend docs
- [ ] Backend docs
- [ ] PROJECT-STATE
```

## Tags

Los tags son baselines inmutables de referencia:

```text
v0.1.0
v0.2.0
...
```

No mover un tag publicado para representar trabajo nuevo.
