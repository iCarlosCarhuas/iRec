# v0.2.0 — Compatibilidad TypeScript

El gate real detectó y corrigió compatibilidad con:

- `otplib 13`: narrowing de resultado antes de usar `timeStep`;
- `jose 6`: claves derivadas sin depender del tipo eliminado `KeyLike`;
- `ioredis 6`: import nombrado `Redis`.

Estas correcciones no alteran el diseño de seguridad; solo alinean el código
con las APIs/tipos de las versiones instaladas.
