# Estrategia de pruebas

## Pirámide

### Unit
- schemas Zod;
- TOTP;
- recovery codes;
- permisos;
- ThemeManifest;
- mappers.

### Integration
- PostgreSQL;
- Redis;
- presigned R2;
- OAuth callback;
- OpenAPI generation.

### Contract
- `/openapi.json` debe generarse en CI;
- snapshot o diff controlado;
- frontend client/types deben coincidir con la versión del contrato.

### E2E
- registro -> TOTP -> dashboard;
- crear álbum -> conectar R2 -> subir foto;
- privado vs público;
- propuesta -> aprobar;
- generar tema;
- conectar YouTube;
- borrar álbum.

## Security tests

- brute force TOTP;
- reuse recovery code;
- expired trusted device;
- IDOR;
- path traversal en object keys;
- SSRF en URLs externas;
- scopes OAuth;
- secretos ausentes en logs.

## Definition of Done

Una historia no se cierra sin:
- tests relevantes;
- OpenAPI actualizado si cambia API;
- changelog correspondiente;
- documentación afectada.
