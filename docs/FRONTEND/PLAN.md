# Plan Frontend

## Objetivo

PWA mobile-first capaz de funcionar como experiencia principal del álbum y panel del creador.

## Módulos

```text
app/
├─ core/
│  ├─ auth/
│  ├─ api/
│  ├─ guards/
│  └─ storage/
├─ features/
│  ├─ auth/
│  ├─ dashboard/
│  ├─ albums/
│  ├─ uploads/
│  ├─ moderation/
│  ├─ themes/
│  ├─ youtube/
│  └─ live/
└─ shared/
```

## Pantallas

1. landing;
2. register/login;
3. TOTP enrollment;
4. recovery;
5. dashboard;
6. create album;
7. storage setup wizard;
8. album viewer;
9. album edit mode;
10. upload;
11. moderation queue;
12. AI theme builder;
13. YouTube connection;
14. live control;
15. settings.

## PWA

- installable;
- app shell cacheable;
- no cachear secretos;
- uploads reanudables cuando sea viable;
- estados offline explícitos;
- share target evaluable en etapa posterior.

## API

Frontend no define manualmente DTOs divergentes.

Los tipos deben derivarse/generarse desde contratos compartidos u OpenAPI.

## Edición

Entrar a edición requiere:
1. sesión válida;
2. ownership validado por servidor;
3. código de edición correcto cuando esté habilitado.

## Theme renderer

Solo renderiza componentes allowlisted:

- hero;
- masonry;
- timeline;
- carousel;
- editorial grid;
- video block;
- live block;
- text block.

Nunca ejecuta JS producido por IA.
