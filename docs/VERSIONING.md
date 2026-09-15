# Versionado y control de cambios

iRec usa **Semantic Versioning**:

- `MAJOR`: cambio incompatible de producto/API.
- `MINOR`: funcionalidad compatible nueva.
- `PATCH`: corrección compatible.

## Dos changelogs, una versión

### `TECH/CHANGELOG.md`

Registra cambios de ingeniería:

- arquitectura;
- API;
- DB/migraciones;
- seguridad;
- infraestructura;
- dependencias;
- observabilidad;
- performance;
- breaking changes técnicos.

### `NONTECH/CHANGELOG.md`

Registra cambios visibles o funcionales:

- nuevos flujos;
- cambios de UX;
- comportamiento de álbumes;
- permisos;
- decisiones de producto;
- criterios de aceptación;
- alcance/no alcance.

## Regla

Una release usa el mismo número en ambos changelogs.

Ejemplo:

```text
TECH    0.2.0 -> nueva integración YouTube OAuth
NONTECH 0.2.0 -> usuario puede conectar su canal y subir videos
```

Si una versión no contiene cambios de una categoría, se agrega igualmente la versión con `Sin cambios aplicables`.

## Formato

```md
## [Unreleased]

### Added
### Changed
### Fixed
### Security
### Removed

## [0.1.0] - YYYY-MM-DD
```

## Pull requests / commits

Cada PR debe indicar:

```text
Docs impact:
- [ ] TECH changelog
- [ ] NONTECH changelog
- [ ] OpenAPI
- [ ] ADR
- [ ] Frontend docs
- [ ] Backend docs
```
