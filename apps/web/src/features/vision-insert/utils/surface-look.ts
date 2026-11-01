import { RECIPE_MATERIALS, type ObjectRecipe, type RecipeMaterial } from '@/lib/object-shape';

/** How a material's surface catches the light in the 3D view (three.js standard material). */
export interface SurfaceLook {
  roughness: number;
  metalness: number;
}

/** Every surface of the 3D view: the AI materials, then `painted` for a part with no material. */
export const SURFACES = [...RECIPE_MATERIALS, 'painted'] as const;
export type Surface = (typeof SURFACES)[number];

/**
 * Look per surface. Matte for stone, thatch, leaves; shiny for glass, water, metal. Metalness stays
 * ≤ 0.6: the viewer has no environment map, and a fully metallic part would render black.
 */
export const SURFACE_LOOK: Record<Surface, SurfaceLook> = {
  stone: { roughness: 0.95, metalness: 0 },
  brick: { roughness: 0.9, metalness: 0 },
  plaster: { roughness: 0.85, metalness: 0 },
  concrete: { roughness: 0.9, metalness: 0 },
  wood: { roughness: 0.75, metalness: 0 },
  thatch: { roughness: 1, metalness: 0 },
  tile: { roughness: 0.6, metalness: 0 },
  slate: { roughness: 0.55, metalness: 0.05 },
  metal: { roughness: 0.35, metalness: 0.6 },
  glass: { roughness: 0.08, metalness: 0.4 },
  plastic: { roughness: 0.4, metalness: 0 },
  fabric: { roughness: 1, metalness: 0 },
  rubber: { roughness: 0.9, metalness: 0 },
  foliage: { roughness: 0.95, metalness: 0 },
  water: { roughness: 0.1, metalness: 0.2 },
  painted: { roughness: 0.6, metalness: 0.05 },
};

/** Index of a part's surface in `SURFACES` (the geometry group's material index). */
export function surfaceIndex(material?: RecipeMaterial): number {
  return SURFACES.indexOf(material ?? 'painted');
}

/** Materials named on a recipe's parts, once each, in part order (the AI's reading, shown in the panel). */
export function recipeMaterials(recipe: Pick<ObjectRecipe, 'parts'>): RecipeMaterial[] {
  const seen: RecipeMaterial[] = [];
  for (const p of recipe.parts) if (p.material && !seen.includes(p.material)) seen.push(p.material);
  return seen;
}
