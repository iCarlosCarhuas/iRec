# v0.2.0 — Decisión de migraciones

Durante la validación real en Windows + Node 24 + PostgreSQL 17,
`drizzle-kit push` terminaba durante `Pulling schema from database...`
con código 1 sin mostrar el error útil.

Se reemplaza el flujo de desarrollo:

```text
db:push
```

por:

```text
db:generate
db:migrate
db:apply
```

`db:migrate` utiliza directamente `drizzle-orm/node-postgres/migrator`, lo cual
permite imprimir la excepción real de PostgreSQL y evita depender del spinner
de Drizzle Kit para la ejecución.
