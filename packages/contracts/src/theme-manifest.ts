import { z } from 'zod';

const ThemeSectionSchema = z.object({
  kind: z.enum([
    'hero',
    'masonry',
    'timeline',
    'carousel',
    'editorial-grid',
    'video',
    'live',
    'text',
  ]),
  assetIds: z.array(z.string().uuid()).default([]),
  text: z.string().max(2000).optional(),
});

export const ThemeManifestSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(100),
  layout: z.enum(['editorial', 'masonry', 'timeline', 'story']),
  mood: z.enum(['warm', 'celebratory', 'elegant', 'nostalgic', 'minimal', 'custom']),
  coverAssetId: z.string().uuid().optional(),
  sections: z.array(ThemeSectionSchema).max(100),
}).meta({
  id: 'ThemeManifest',
  description: 'Salida segura y validable para el renderer de temas generado por IA',
});

export type ThemeManifest = z.infer<typeof ThemeManifestSchema>;
