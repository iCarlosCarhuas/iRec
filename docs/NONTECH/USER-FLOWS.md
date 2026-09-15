# Flujos de usuario

## Registro

```mermaid
flowchart TD
A[Ingresar email] --> B[Enviar verificación]
B --> C[Confirmar correo]
C --> D[Mostrar QR TOTP]
D --> E[Confirmar primer código]
E --> F[Mostrar recovery codes]
F --> G[Dashboard]
```

## Login

```mermaid
flowchart TD
A[Email] --> B{Trusted device válido?}
B -- Sí --> E[Dashboard]
B -- No --> C[Solicitar TOTP]
C --> D[Validar]
D --> E
```

## Crear álbum

```mermaid
flowchart TD
A[Dashboard] --> B[Nuevo álbum]
B --> C[Nombre / descripción]
C --> D[Público o privado]
D --> E[Elegir almacenamiento]
E --> F[Configurar o reutilizar R2]
F --> G[Álbum creado]
```

## Propuesta de contenido

```mermaid
flowchart LR
A[Invitado propone foto] --> B[Pendiente]
B --> C{Propietario}
C -->|Aprueba| D[Visible]
C -->|Rechaza| E[No publicado]
```

## Generación IA

1. Usuario selecciona fotos.
2. Puede indicar una intención estética opcional.
3. IA analiza contenido permitido.
4. Propone clasificación, portada, orden y ThemeManifest.
5. Backend valida el ThemeManifest.
6. Usuario previsualiza.
7. Usuario acepta o regenera.
