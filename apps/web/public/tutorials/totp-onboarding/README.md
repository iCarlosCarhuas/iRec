# iRec TOTP onboarding — HyperFrames v2

Tutorial preciso del flujo real de `iRec /auth/totp/setup`.

## Camino principal

```text
Play Store / App Store
→ Google Authenticator
→ +
→ Escanear un código QR
→ QR visible en iRec
→ código iRec de 6 dígitos
→ campo Código TOTP
→ Activar TOTP
→ guardar 10 recovery codes
```

Alternativa Microsoft Authenticator:

```text
+
→ Otra cuenta
→ Escanear un código QR
```

## Integración

El reproductor NO abre una ruta de producto distinta. Se monta dentro de:

```text
/auth/totp/setup
```

mediante un iframe de asset local.

## Seguridad

Nunca insertar en la composición:
- QR real;
- manualEntryKey real;
- correo real obtenido en runtime;
- recovery codes reales;
- cookies/JWT/refresh.

Todo dato mostrado en el video es ficticio.

## QA

```bash
npx hyperframes lint
npx hyperframes check
```

La advertencia `timeline_track_too_dense` es de mantenibilidad. Si el tutorial
sigue creciendo, separar escenas en subcomposiciones.
