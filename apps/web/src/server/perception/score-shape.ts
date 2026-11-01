import 'server-only';

import type { ObjectRecipe, ShapeTarget } from '@/lib/object-shape';
import { pathToRings } from '@/lib/vision';
import { renderFlat } from './flat-render';
import { scoreModel, type ModelScore } from './model-score';
import type { PhotoForRegions } from './region';
import { sampleObjectRgb } from './shape-colors';
import { fitGrid, ringsMask } from './silhouette-fit';

/**
 * Score of a recipe against the selected box (PR-0.2): flat render, photo box and SAM mask on the fit grid.
 * Null without an outline (no mask to compare with).
 */
export async function scoreRecipe(
  photo: PhotoForRegions,
  target: Pick<ShapeTarget, 'box' | 'outline'>,
  recipe: ObjectRecipe
): Promise<ModelScore | null> {
  const rings = target.outline ? pathToRings(target.outline).filter((r) => r.length >= 3) : [];
  const { box } = target;
  const aspect = (box.w * photo.width) / (box.h * photo.height);
  if (!rings.length || !(aspect > 0)) return null;
  const { cols, rows } = fitGrid(aspect);
  const crop = await sampleObjectRgb(photo, box, cols, rows);
  return scoreModel(
    renderFlat(recipe, aspect, cols, rows),
    crop,
    ringsMask(rings, box, cols, rows)
  );
}
