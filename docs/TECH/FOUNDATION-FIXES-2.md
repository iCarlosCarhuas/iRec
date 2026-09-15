# v0.1.0 — Foundation stabilization 2

Problemas encontrados durante la ejecución real en Windows:

## TypeScript / NestJS

La API requería declarar explícitamente los tipos de Node.

Se agregó:

```json
"types": ["node"]
```

Esto habilita correctamente:

- `process`
- `console`
- `URL`
- `node:fs/promises`
- `import.meta.url`

También se agregó:

```json
"rootDir": "./src"
```

para satisfacer las reglas más estrictas de TypeScript 6.

## Declaraciones

`apps/api` es una aplicación ejecutable, no una librería publicada.

Por ello:

```json
"declaration": false
```

evita generar `.d.ts` innecesarios y elimina errores de portabilidad de tipos
inferidos como `TS2883`.

`packages/contracts` continúa generando declaraciones porque sí funciona como
paquete compartido.

## verify-foundation.ps1

El script anterior tenía dos defectos:

1. contenía un carácter `\\` accidental al inicio;
2. una falla de un script pnpm podía no interrumpir correctamente el pipeline.

Ahora los comandos pnpm se ejecutan mediante `cmd.exe` y se valida explícitamente
`$LASTEXITCODE`.

Si `typecheck`, `openapi:check` o `build` falla, la verificación termina
inmediatamente con `[FAIL]`.
