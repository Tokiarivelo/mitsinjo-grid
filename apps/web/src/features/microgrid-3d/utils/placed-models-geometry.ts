import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SectorId } from '@mitsinjo/engine';
import type { KitArchetype } from '@/lib/object-kit';
import type { ObjectRecipe } from '@/lib/object-shape';
import { recipeMesh } from '@/features/vision-insert/utils/object-geometry';
import { terrainHeight } from './landscape';
import { footprint, sceneScale } from '@/stores/placed-models.store';

export interface PlacedModelItem {
  id: string;
  sector: SectorId;
  running: boolean;
  position: [number, number, number];
  recipe: ObjectRecipe;
  scale?: number;
  yaw?: number;
  archetype?: KitArchetype;
}

export interface PlacedPlinth {
  position: [number, number, number];
  size: [number, number, number];
}

export interface PlacedModelsGeometryResult {
  /** Single merged geometry for all placed models (1 draw call). Null if empty. */
  modelsGeometry: THREE.BufferGeometry | null;
  /** Concrete plinths under models on sloped ground. */
  plinths: PlacedPlinth[];
  /** Heights and footprint radius per model id (for tag positioning and click bounds). */
  modelBounds: Record<string, { height: number; radius: number }>;
}

export interface SectorStateOverride {
  unserved?: boolean;
  onFire?: boolean;
}

const tmpColor = new THREE.Color();

/**
 * Builds a single merged BufferGeometry for all placed models (PI-T2):
 * - Reuses `recipeMesh` from vision-insert (no code duplication).
 * - Sits on `terrainHeight` at the lowest point of the footprint (plinth if slope).
 * - Applies departure states (dimmed if unserved/delested, fiery tint if sector on fire).
 * - Merges into ONE BufferGeometry (≤ +2 draw calls budget for up to 30 objects).
 * - Provides simple LOD box on tier `low`.
 */
export function buildPlacedModelsGeometry(
  items: readonly PlacedModelItem[],
  sectorStatus?: Partial<Record<SectorId, SectorStateOverride>>,
  tier: 'high' | 'low' = 'high'
): PlacedModelsGeometryResult {
  if (items.length === 0) {
    return { modelsGeometry: null, plinths: [], modelBounds: {} };
  }

  const plinths: PlacedPlinth[] = [];
  const modelBounds: Record<string, { height: number; radius: number }> = {};
  const geometriesToMerge: THREE.BufferGeometry[] = [];

  for (const item of items) {
    const effScale = item.scale ?? sceneScale(item.archetype, item.recipe.proportions);
    const effYaw = item.yaw ?? item.recipe.yaw ?? 0;
    const fp = footprint(item.recipe, effScale, effYaw);

    const x = item.position[0];
    const z = item.position[2];

    // Sample terrain height at center and footprint corners
    const hCenter = terrainHeight(x, z);
    const h1 = terrainHeight(x + fp.box.minX, z + fp.box.minZ);
    const h2 = terrainHeight(x + fp.box.maxX, z + fp.box.minZ);
    const h3 = terrainHeight(x + fp.box.maxX, z + fp.box.maxZ);
    const h4 = terrainHeight(x + fp.box.minX, z + fp.box.maxZ);

    const baseH = Math.min(hCenter, h1, h2, h3, h4);
    const maxH = Math.max(hCenter, h1, h2, h3, h4);
    const slope = maxH - baseH;

    // Add plinth if terrain is significantly sloped
    if (slope > 0.04) {
      plinths.push({
        position: [x, (baseH + maxH) / 2, z],
        size: [fp.box.width + 0.1, Math.max(0.08, slope + 0.04), fp.box.depth + 0.1],
      });
    }

    let g: THREE.BufferGeometry;
    if (tier === 'low') {
      // Simple LOD box on low tier
      const height = item.recipe.proportions.h * effScale;
      g = new THREE.BoxGeometry(fp.box.width, height, fp.box.depth);
      const mainColor = item.recipe.parts[0]?.color ?? '#64748b';
      tmpColor.set(mainColor);
      const count = g.getAttribute('position').count;
      const colors = new Float32Array(count * 3);
      for (let c = 0; c < count; c++) tmpColor.toArray(colors, c * 3);
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    } else {
      // High tier: full recipe geometry
      const recipeWithYaw =
        item.yaw !== undefined && item.yaw !== item.recipe.yaw
          ? { ...item.recipe, yaw: item.yaw }
          : item.recipe;
      const original = recipeMesh(recipeWithYaw);
      g = original.clone();
      original.dispose();
    }

    g.computeBoundingBox();
    const bb = g.boundingBox;
    const bottomY = bb ? bb.min.y : 0;
    const rawHeight = bb ? bb.max.y - bb.min.y : item.recipe.proportions.h;
    const finalHeight = rawHeight * (tier === 'low' ? 1 : effScale);

    modelBounds[item.id] = {
      height: finalHeight,
      radius: fp.radius,
    };

    if (tier !== 'low') {
      g.scale(effScale, effScale, effScale);
    }
    // Translate so bottom of model rests on baseH
    g.translate(x, baseH - bottomY * (tier === 'low' ? 1 : effScale), z);

    // Apply feeder / departure states to vertex colors
    const sec = sectorStatus?.[item.sector];
    const onFire = sec?.onFire ?? false;
    const unserved = sec?.unserved ?? !item.running;

    const colorAttr = g.getAttribute('color');
    if (colorAttr) {
      for (let j = 0; j < colorAttr.count; j++) {
        let r = colorAttr.getX(j);
        let gr = colorAttr.getY(j);
        let b = colorAttr.getZ(j);

        if (onFire) {
          // Fiery / burnt amber-red alert tint
          r = Math.min(1, r * 1.5 + 0.3);
          gr = gr * 0.35;
          b = b * 0.25;
        } else if (unserved) {
          // Unpowered / darkened lights out
          r = r * 0.45;
          gr = gr * 0.45;
          b = b * 0.45;
        }
        colorAttr.setXYZ(j, r, gr, b);
      }
      colorAttr.needsUpdate = true;
    }

    geometriesToMerge.push(g);
  }

  const merged = mergeGeometries(geometriesToMerge, false) ?? null;
  for (const g of geometriesToMerge) g.dispose();

  return {
    modelsGeometry: merged,
    plinths,
    modelBounds,
  };
}
