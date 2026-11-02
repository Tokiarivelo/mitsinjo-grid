import 'server-only';

import type { KitArchetype } from '@/lib/object-kit';
import {
  frontPartIndex,
  type DimStatus,
  type ObjectRecipe,
  type PartMask,
  type RecipePart,
} from '@/lib/object-shape';
import { isChimneyStack } from './mask-chimney';
import { isWheelPart, PART_MIRROR_MIN_Z, roofTopAbove, type MaskMapGeom } from './mask-geometry';
import { vehicleShell } from './mask-panels';
import { buildLandmarks } from './score-shape';

export interface GraphNode {
  index: number;
  /** Parent part index, or null for the main body (root). */
  parent: number | null;
  status: DimStatus;
}

/** Parent → child graph of one recipe: panel → wall, chimney → roof, wheel → body, gable → wall. */
export interface ObjectGraph {
  nodes: GraphNode[];
}

/** Photo evidence the statuses are judged against (masks need their mapping geometry). */
export interface GraphEvidence {
  outline?: boolean;
  masks?: ReadonlyArray<PartMask>;
  geom?: MaskMapGeom;
  /** A photo was available at all (without one every template prior reads unknown). */
  photo?: boolean;
}

/**
 * Clampable face plate (glass, door, decal): a box whose thinnest axis is z, sitting on (or
 * proud of) either face of its parent. Inset leaves (PR-2.17, centred in the wall) and side
 * plates (end windows, seams: thinnest in x/y) are placed by construction, never clamped.
 */
function isPanelPart(p: RecipePart, parent: RecipePart): boolean {
  if (p === parent || p.shape !== 'box' || p.size[2] > 0.05) return false;
  if (p.size[2] > Math.min(p.size[0], p.size[1])) return false;
  const front = parent.at[2] + parent.size[2] / 2;
  const back = parent.at[2] - parent.size[2] / 2;
  return p.at[2] + p.size[2] / 2 >= front - 0.02 || p.at[2] - p.size[2] / 2 <= back + 0.02;
}

/** Far-side twin of a near part: the same plate back to back. */
function isMirrorTwin(p: RecipePart, q: RecipePart): boolean {
  return (
    p.shape === q.shape &&
    p.color === q.color &&
    p.size[0] === q.size[0] &&
    p.size[1] === q.size[1] &&
    p.size[2] === q.size[2] &&
    p.at[0] === q.at[0] &&
    p.at[1] === q.at[1] &&
    Math.sign(p.at[2]) !== Math.sign(q.at[2])
  );
}

/**
 * Measured lathe check: the lathe pass closes both poles at r = 0, the three template lathes
 * (tank, lamp head, lamp bowl) never do. Extrudes need no check: only the profile pass builds them.
 */
function isMeasuredLathe(p: RecipePart): boolean {
  const profile = p.profile;
  return (
    p.shape === 'lathe' &&
    !!profile &&
    profile.length > 0 &&
    profile[0]![0] === 0 &&
    profile[profile.length - 1]![0] === 0
  );
}

/**
 * Parent → child graph of a recipe (PR-2.14), built once after the mask passes. Panels hang under
 * the face behind them (vehicle shell, else the main body), wheels and gables under the main body,
 * chimney stacks under the roof part they pierce. Pure.
 */
export function buildGraph(
  archetype: KitArchetype,
  recipe: ObjectRecipe,
  evidence?: GraphEvidence
): ObjectGraph {
  const main = recipe.parts[frontPartIndex(recipe)]!;
  const eave = main.at[1] + main.size[1] / 2;
  const shell = archetype === 'vehicle' ? (vehicleShell(recipe.parts, main) ?? main) : main;
  // Mask-matched parts (same matching as the landmark score, PR-0.8): grid numbers discarded.
  const measured = new Set<number>();
  if (evidence?.masks?.length && evidence.geom) {
    for (const lm of buildLandmarks(recipe, evidence.masks, evidence.geom, 1, 1)) {
      measured.add(lm.part);
    }
  }
  const measuredStructure = !!evidence?.outline || (evidence?.masks?.length ?? 0) > 0;
  const roofs = recipe.parts.filter(
    (p) =>
      p !== main &&
      !(archetype === 'house' && isChimneyStack(p, main.at[1], eave)) &&
      p.at[1] + p.size[1] / 2 > eave
  );
  const nodes = recipe.parts.map((p, i) => {
    let parent: number | null = null;
    if (p !== main) {
      if (isPanelPart(p, shell)) {
        parent = recipe.parts.indexOf(shell);
      } else if (isWheelPart(p, main.at[1])) {
        parent = recipe.parts.indexOf(main);
      } else if (archetype === 'house' && isChimneyStack(p, main.at[1], eave)) {
        let best = -1;
        let bestTop = -Infinity;
        for (const r of roofs) {
          if (Math.abs(p.at[0] - r.at[0]) > r.size[0] / 2 + p.size[0] / 2) continue;
          const top = r.at[1] + r.size[1] / 2;
          if (top > bestTop) {
            bestTop = top;
            best = recipe.parts.indexOf(r);
          }
        }
        parent = best >= 0 ? best : recipe.parts.indexOf(main);
      } else {
        parent = recipe.parts.indexOf(main);
      }
    }
    let status: DimStatus;
    if (measured.has(i) || p.shape === 'extrude' || isMeasuredLathe(p)) {
      status = 'measured';
    } else if (
      p.at[2] < -PART_MIRROR_MIN_Z &&
      recipe.parts.some((q) => q !== p && q.at[2] > 0 && isMirrorTwin(p, q))
    ) {
      status = 'inferred';
    } else if (measuredStructure) {
      // Template part placed on measured structure (fitted body, outline): derived, not guessed.
      status = 'inferred';
    } else {
      status = evidence?.photo ? 'estimated' : 'unknown';
    }
    return { index: i, parent, status };
  });
  return { nodes };
}

/** Move smaller than this is float dust, not a fix. */
const FIX_EPS = 1e-9;

/** Clamp a panel into its parent face span (generalises the panels clamp); same ref when clean. */
function clampPanel(p: RecipePart, parent: RecipePart): RecipePart {
  const x0 = parent.at[0] - parent.size[0] / 2;
  const x1 = parent.at[0] + parent.size[0] / 2;
  const y0 = parent.at[1] - parent.size[1] / 2;
  const y1 = parent.at[1] + parent.size[1] / 2;
  const w = Math.min(p.size[0], x1 - x0);
  const h = Math.min(p.size[1], y1 - y0);
  const cx = Math.min(x1 - w / 2, Math.max(x0 + w / 2, p.at[0]));
  const cy = Math.min(y1 - h / 2, Math.max(y0 + h / 2, p.at[1]));
  if (
    Math.abs(cx - p.at[0]) <= FIX_EPS &&
    Math.abs(cy - p.at[1]) <= FIX_EPS &&
    Math.abs(w - p.size[0]) <= FIX_EPS &&
    Math.abs(h - p.size[1]) <= FIX_EPS
  ) {
    return p;
  }
  const at: [number, number, number] = [cx, cy, p.at[2]];
  const size: [number, number, number] = [w, h, p.size[2]];
  return { ...p, at, size };
}

/**
 * Constraint pass (PR-2.14): panels clamp into their parent span, chimney feet drop onto the roof
 * plane. Runs after every reshape; returns the recipe unchanged (same reference) when coherent.
 * Pure: same inputs → same recipe.
 */
export function applyConstraints(archetype: KitArchetype, recipe: ObjectRecipe): ObjectRecipe {
  const main = recipe.parts[frontPartIndex(recipe)]!;
  const eave = main.at[1] + main.size[1] / 2;
  const shell = archetype === 'vehicle' ? (vehicleShell(recipe.parts, main) ?? main) : main;
  const isStack = (p: RecipePart) => archetype === 'house' && isChimneyStack(p, main.at[1], eave);
  const roofTop = roofTopAbove(recipe.parts, eave, (p) => p === main || isStack(p));
  let moved = false;
  const parts = recipe.parts.map((p) => {
    if (isPanelPart(p, shell)) {
      const q = clampPanel(p, shell);
      if (q !== p) moved = true;
      return q;
    }
    if (isStack(p)) {
      const bottom = p.at[1] - p.size[1] / 2;
      if (bottom > roofTop + FIX_EPS) {
        moved = true;
        const at: [number, number, number] = [p.at[0], p.at[1] - (bottom - roofTop), p.at[2]];
        return { ...p, at };
      }
    }
    return p;
  });
  return moved ? { ...recipe, parts } : recipe;
}

/**
 * Coherence violations of a recipe (PR-2.14): panels outside their parent span, chimney stacks
 * floating above the roof. The loop report shows the count; the shipped recipe always scores 0.
 */
export function checkConstraints(archetype: KitArchetype, recipe: ObjectRecipe): number {
  const main = recipe.parts[frontPartIndex(recipe)]!;
  const eave = main.at[1] + main.size[1] / 2;
  const shell = archetype === 'vehicle' ? (vehicleShell(recipe.parts, main) ?? main) : main;
  const isStack = (p: RecipePart) => archetype === 'house' && isChimneyStack(p, main.at[1], eave);
  const roofTop = roofTopAbove(recipe.parts, eave, (p) => p === main || isStack(p));
  let n = 0;
  for (const p of recipe.parts) {
    if (isPanelPart(p, shell)) {
      if (clampPanel(p, shell) !== p) n++;
    } else if (isStack(p)) {
      if (p.at[1] - p.size[1] / 2 > roofTop + FIX_EPS) n++;
    }
  }
  return n;
}
