# v0.3.0 — AD-1 Album Domain Foundation

## Objetivo

Introducir el dominio mínimo de álbumes sin implementar todavía UI, R2, IA,
YouTube ni moderación de contenido.

AD-1 agrega dos piezas persistentes:

- `albums`
- `album_members`

y los contratos TypeScript/Zod correspondientes.

## Decisiones

### Ownership

`albums.owner_id` identifica al propietario principal.

Además, el propietario debe tener una membresía:

- `role = owner`
- `status = active`

La coherencia entre ambas representaciones se implementará de forma atómica en
el service layer cuando se construya AD-2 (Album API). No se intenta esconder
esa regla dentro de triggers de PostgreSQL en AD-1.

### Visibilidad

Valores:

- `public`
- `private`

Un álbum nace como `private`.

### Membresías

Roles iniciales:

- `owner`
- `member`

Estados:

- `active`
- `invited`
- `removed`

`moderator` se difiere hasta la iteración de moderación si el flujo real lo
requiere. Evitamos crear roles sin comportamiento implementado.

## Seguridad de datos

AD-1 NO aplica migraciones automáticamente.

Flujo obligatorio antes de modificar PostgreSQL:

1. `irec-data.ps1 backup`
2. `irec-data.ps1 verify`
3. `pnpm db:generate`
4. revisar SQL generado
5. `pnpm db:apply`
6. comprobar `irec-migrate`
7. gate AD-1

Nunca usar `down -v` ni eliminar volúmenes para aplicar una migración.

## Fuera de alcance

- fotos / Cloudflare R2
- ThemeManifest / IA
- YouTube / Live
- contenido y propuestas
- endpoints REST de Album
- UI Angular
