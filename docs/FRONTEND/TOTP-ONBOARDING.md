# TOTP onboarding

## Ruta

```text
/auth/totp/setup
```

## Objetivo

Una persona que nunca ha usado TOTP debe poder configurar su cuenta sin
conocimiento técnico previo.

## Flujo UI

```text
¿No tienes una app de autenticación?
→ Ver paso a paso
→ Ver tutorial animado · HyperFrames
```

## Camino principal

Google Authenticator:

```text
Store
→ Google Authenticator
→ instalar
→ abrir
→ +
→ Escanear un código QR
→ escanear QR de iRec
→ código de 6 dígitos
→ volver a iRec
→ Activar TOTP
```

## Microsoft Authenticator

```text
+
→ Otra cuenta
→ Escanear un código QR
```

## Seguridad

El tutorial HyperFrames utiliza datos ficticios.

Nunca recibe:

- QR real;
- manualEntryKey real;
- correo real;
- recovery codes reales;
- cookies;
- JWT;
- refresh token.

## Recovery codes

Después de activar TOTP:

- iRec muestra 10;
- se pueden copiar;
- se pueden descargar;
- deben confirmarse como guardados antes de continuar;
- no se guardan en localStorage.
