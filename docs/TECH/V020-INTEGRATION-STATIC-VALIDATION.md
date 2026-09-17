# v0.2.0 — Integración static validation

**Fecha:** 2026-09-16  
**Resultado:** PASSED para checks estáticos.  
**Runtime Docker:** pendiente en host con Docker daemon.

## Checks ejecutados

```text
JSON package/manifest parse                     PASS
compose.yaml YAML parse                         PASS
servicios Compose requeridos                    PASS
pnpm lock combinado                             PASS
API Identity dependencies en lock               PASS
@irec/contracts frontend en lock                PASS
imports TypeScript relativos resuelven          PASS
archivos full-stack requeridos                  PASS
.env.docker ignorado por Git                    PASS
.env.docker.example trackeable                  PASS
service-name networking interno                 PASS
generate-docker-env.mjs syntax                  PASS
AES-256 generado = 32 bytes                     PASS
RSA private PKCS#8                              PASS
RSA public SPKI                                 PASS
segunda generación no sobrescribe env           PASS
```

## Lo que no se marca como aprobado aquí

Este entorno de construcción no dispone de Docker daemon, por lo que todavía
debe ejecutarse en la máquina de integración:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-fullstack-docker.ps1
```

Ese gate valida imágenes, Compose, healthchecks, migración, Web, API, Scalar y
Mailpit en ejecución real.
