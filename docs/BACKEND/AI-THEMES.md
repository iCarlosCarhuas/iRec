# IA y ThemeManifest

## Entrada

- selección de fotos;
- metadata técnica;
- timestamps cuando existan;
- prompt opcional del propietario;
- restricciones del renderer.

## Salida

Un `ThemeManifest` Zod-validable, por ejemplo:

```json
{
  "version": 1,
  "name": "Golden Memories",
  "layout": "editorial",
  "mood": "warm",
  "coverAssetId": "...",
  "sections": [
    {
      "kind": "masonry",
      "assetIds": ["...", "..."]
    }
  ]
}
```

## Prohibido

- HTML arbitrario;
- JavaScript;
- CSS remoto;
- iframes fuera de proveedores allowlisted;
- URLs no validadas.

## Generación

1. analizar;
2. clasificar;
3. ordenar;
4. generar manifiesto;
5. parsear con Zod;
6. aplicar reglas de negocio;
7. guardar draft;
8. mostrar preview;
9. aplicar solo tras confirmación.
