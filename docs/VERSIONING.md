# Versionado y control de cambios

iRec usa Semantic Versioning.

```text
MAJOR.MINOR.PATCH
```

## Estado

```text
v0.1.0  Foundation  released
v0.2.0  Identity    integration pending
```

## Capas de una versión

```text
feat/* + docs/*
      ↓
integration/vX.Y.Z
      ↓ gates + E2E
main
      ↓ final gate
tag vX.Y.Z
```

Un gate aislado no crea una release.

## Criterio para etiquetar v0.2.0

1. backend gate aprobado;
2. frontend gate aprobado;
3. documentación sincronizada;
4. `integration/v0.2.0` creado;
5. full-stack Docker aprobado;
6. E2E Identity aprobado;
7. gate final integrado;
8. PR/merge a `main`;
9. gate final desde `main`;
10. tag `v0.2.0`.

## Dos changelogs, una versión

### TECH
Arquitectura, API, DB, seguridad, infraestructura, dependencias.

### NONTECH
Comportamiento visible, UX, alcance y decisiones de producto.

## Checklist de impacto

```text
Docs impact:
- [ ] TECH changelog
- [ ] NONTECH changelog
- [ ] OpenAPI
- [ ] ADR
- [ ] Frontend docs
- [ ] Backend docs
- [ ] PROJECT-STATE
- [ ] Docker/runbook
```

## Tags

Los tags publicados son baselines inmutables:

```text
v0.1.0
v0.2.0
...
```

No mover un tag publicado para representar trabajo nuevo.
