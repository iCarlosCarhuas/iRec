# Integración YouTube

## Objetivos

- conectar canal mediante OAuth;
- subir video desde experiencia iRec;
- registrar IDs de video;
- embeber contenido;
- crear broadcast live;
- mantener grabación resultante.

## Privacidad

Por defecto:

```text
unlisted
```

El usuario puede cambiar opciones cuando YouTube/API lo permita.

## Live desde navegador

```text
Browser camera/mic
      ↓ WebRTC
Media Gateway
      ↓ RTMPS
YouTube Live
      ↓
YouTube recording
```

El backend administra recursos de YouTube; el gateway transporta media.

## Borrado

Eliminar un álbum no debe borrar videos del canal automáticamente.

La eliminación remota requiere acción explícita separada.
