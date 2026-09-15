# Infraestructura local

En `0.1.0`, PostgreSQL y Redis se levantan para preparar el entorno pero la API de health no depende de ellos.

```bash
pnpm dev:infra
pnpm dev:infra:down
```

Las integraciones externas (R2, YouTube, email, IA) se incorporaran por versiones posteriores.
