# ADR-0009 — JWT RS256 + refresh token rotativo

**Estado:** Accepted  
**Objetivo:** v0.2.0  
**Supersede:** componente de sesión opaca propuesto inicialmente en ADR-0007.

## Decisión

Identity usa:

```text
JWT RS256 corto
+
refresh token opaco rotativo
+
estado de seguridad en Redis
```

### Access
- 15 minutos;
- HttpOnly cookie;
- `iss`, `aud`, `sub`, `jti`, `iat`, `exp`;
- no localStorage.

### Refresh
- CSPRNG;
- 12 horas en configuración local actual;
- hash SHA-256 como identificador de lookup;
- rotación por uso;
- reuse detection;
- family revocation.

## Motivo

Combina access token autocontenido de vida corta con capacidad de revocar
sesiones/refresh families sin exponer tokens a JavaScript.

## Consecuencia

Redis es dependencia crítica de Identity para refresh, revocación y auth flows.
