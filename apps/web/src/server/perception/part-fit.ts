import 'server-only';

import type { KitArchetype } from '@/lib/object-kit';
import {
  frontPartIndex,
  RECIPE_BOUND,
  type ObjectRecipe,
  type RecipePart,
  type ShapeTarget,
} from '@/lib/object-shape';
import { pathToRings } from '@/lib/vision';
import { renderFlat } from './flat-render';
import { isWheelPart } from './mask-geometry';
import { nelderMead } from './nelder-mead';
import { photoTerms, scoreRender, type PhotoTerms } from './model-score';
import type { PhotoForRegions } from './region';
import { sampleObjectRgb } from './shape-colors';
import { ringsMask, type Mask } from './silhouette-fit';

/**
 * Fit v2 (PR-2.9): per-part parameters by coordinate descent on the model score. Where PF-T6 fits
 * the whole template (width, depth, yaw, eave), this refines what the templates place approximately:
 * wheel radius, cabin box (vehicles), wall/roof boundary (houses). One pass over the archetype's
 * groups, each minimised with multi-start Nelder–Mead (3 seeded starts) on the raw (unrounded)
 * score at a coarse grid, and kept only when the score rises. Pure and deterministic; ≤ 300 ms
 * with the rest of the shape math (coarse renders, tiny eval budgets, no groups = no cost).
 */

/** Fit grid width (rows follow the box aspect): coarse renders keep the loop in budget. */
export const FIT2_COLUMNS = 48;
/** Rows of the fit grid, clamped so tall boxes stay cheap. */
export const fit2Rows = (aspect: number) =>
  Math.min(96, Math.max(16, Math.round(FIT2_COLUMNS / aspect)));
/** Nelder–Mead evaluations per start, and stops when the simplex spans less than this (raw points). */
export const FIT2_MAX_EVALS = 8;
export const FIT2_TOL = 0.2;
/** Pull back to the start (per squared step): flat dims (a hidden far wheel) must not wander. */
export const FIT2_PRIOR = 0.1;
/** A group is kept only when the raw score rises by more than this. */
export const FIT2_MIN_GAIN = 0.05;

export interface FitTerms {
  aspect: number;
  cols: number;
  rows: number;
  outline: Mask;
  photo: PhotoTerms;
}

/** Photo crop + outline on the fit grid, once per object. Null without an outline or aspect. */
export async function preparePartFit(
  photo: PhotoForRegions,
  target: Pick<ShapeTarget, 'box' | 'outline'>
): Promise<FitTerms | null> {
  const rings = target.outline ? pathToRings(target.outline).filter((r) => r.length >= 3) : [];
  const { box } = target;
  const aspect = (box.w * photo.width) / (box.h * photo.height);
  if (!rings.length || !(aspect > 0)) return null;
  const cols = FIT2_COLUMNS;
  const rows = fit2Rows(aspect);
  const crop = await sampleObjectRgb(photo, box, cols, rows);
  const outline = ringsMask(rings, box, cols, rows);
  return { aspect, cols, rows, outline, photo: photoTerms(crop, outline) };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** One tunable group: a low-dim vector applied to some parts of the recipe. */
interface ParamGroup {
  name: string;
  x0: number[];
  steps: number[];
  apply: (recipe: ObjectRecipe, x: number[]) => ObjectRecipe;
}

const scaleSizes = (parts: RecipePart[], idx: number[], sx: number, sy: number): RecipePart[] =>
  parts.map((p, i) =>
    idx.includes(i)
      ? {
          ...p,
          size: [
            clamp(p.size[0] * sx, 0.01, 1),
            clamp(p.size[1] * sy, 0.01, 1),
            p.size[2],
          ] as RecipePart['size'],
        }
      : p
  );

/** Wheel radius (log scale, ×0.7–1.4): z-axis cylinders below the body's middle. */
function wheelGroup(recipe: ObjectRecipe): ParamGroup | null {
  const midY = recipe.parts[frontPartIndex(recipe)]!.at[1];
  const idx = recipe.parts.map((p, i) => (isWheelPart(p, midY) ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return null;
  return {
    name: 'wheels',
    x0: [0],
    steps: [0.12],
    apply: (r, x) => {
      const s = Math.exp(clamp(x[0]!, -0.35, 0.35));
      return { ...r, parts: scaleSizes(r.parts, idx, s, s) };
    },
  };
}

/** Cabin box (dy shift, y scale): boxes and prisms above the body's middle. */
function cabinGroup(recipe: ObjectRecipe): ParamGroup | null {
  const midY = recipe.parts[frontPartIndex(recipe)]!.at[1];
  const idx = recipe.parts
    .map((p, i) => ((p.shape === 'box' || p.shape === 'prism') && p.at[1] > midY ? i : -1))
    .filter((i) => i >= 0);
  if (!idx.length) return null;
  return {
    name: 'cabin',
    x0: [0, 0],
    steps: [0.03, 0.08],
    apply: (r, x) => {
      const dy = clamp(x[0]!, -0.06, 0.06);
      const sy = Math.exp(clamp(x[1]!, -0.22, 0.22));
      return {
        ...r,
        parts: r.parts.map((p, i) =>
          idx.includes(i)
            ? {
                ...p,
                at: [
                  p.at[0],
                  clamp(p.at[1] + dy, -RECIPE_BOUND, RECIPE_BOUND),
                  p.at[2],
                ] as RecipePart['at'],
                size: [p.size[0], clamp(p.size[1] * sy, 0.01, 1), p.size[2]] as RecipePart['size'],
              }
            : p
        ),
      };
    },
  };
}

/** Wall/roof boundary (dy shift): the front wall top and the gable bottoms move together. */
function eaveGroup(recipe: ObjectRecipe): ParamGroup | null {
  const wall = frontPartIndex(recipe);
  const gables = recipe.parts.map((p, i) => (p.shape === 'prism' ? i : -1)).filter((i) => i >= 0);
  if (recipe.parts[wall]!.shape !== 'box' || !gables.length) return null;
  return {
    name: 'eave',
    x0: [0],
    steps: [0.02],
    apply: (r, x) => {
      const dy = clamp(x[0]!, -0.05, 0.05);
      return {
        ...r,
        parts: r.parts.map((p, i) => {
          if (i === wall)
            return {
              ...p,
              at: [p.at[0], p.at[1] + dy / 2, p.at[2]] as RecipePart['at'],
              size: [p.size[0], clamp(p.size[1] + dy, 0.01, 1), p.size[2]] as RecipePart['size'],
            };
          if (gables.includes(i))
            return {
              ...p,
              at: [p.at[0], p.at[1] + dy / 2, p.at[2]] as RecipePart['at'],
              size: [p.size[0], clamp(p.size[1] - dy, 0.01, 1), p.size[2]] as RecipePart['size'],
            };
          return p;
        }),
      };
    },
  };
}

/** Tunable groups of an archetype on this recipe (fixed order, one coordinate-descent pass). */
function groupsFor(archetype: KitArchetype, recipe: ObjectRecipe): ParamGroup[] {
  switch (archetype) {
    case 'vehicle':
      return [wheelGroup(recipe), cabinGroup(recipe)].filter((g): g is ParamGroup => !!g);
    case 'house':
      return [eaveGroup(recipe)].filter((g): g is ParamGroup => !!g);
    default:
      return [];
  }
}

/** True when the fit would try anything (the pipeline skips the photo sampling otherwise). */
export function hasPartGroups(archetype: KitArchetype, recipe: ObjectRecipe): boolean {
  return groupsFor(archetype, recipe).length > 0;
}

export interface PartFit {
  /** The fitted recipe, or the input itself when no group improved the score. */
  recipe: ObjectRecipe;
  /** Raw score of the returned recipe on the fit grid. */
  score: number;
  /** Flat renders scored (base + optimisation + acceptance). */
  evals: number;
  /** Groups that improved the score, with their raw gain. */
  groups: Array<{ name: string; gain: number }>;
}

/**
 * One coordinate-descent pass over the archetype's groups: 3 seeded starts (x0, x0±step) of
 * Nelder–Mead per group on −score + prior, the group's best kept only when the pure score rises.
 */
export function fitPartParams(
  recipe: ObjectRecipe,
  archetype: KitArchetype,
  terms: FitTerms
): PartFit {
  const groups = groupsFor(archetype, recipe);
  const scoreOf = (r: ObjectRecipe) =>
    scoreRender(renderFlat(r, terms.aspect, terms.cols, terms.rows), terms.outline, terms.photo)
      .score;
  if (!groups.length) return { recipe, score: scoreOf(recipe), evals: 1, groups: [] };
  let current = recipe;
  let base = scoreOf(recipe);
  let evals = 1;
  const improved: PartFit['groups'] = [];
  for (const g of groups) {
    const cost = (x: number[]) => {
      const prior = FIT2_PRIOR * x.reduce((s, v, i) => s + ((v - g.x0[i]!) / g.steps[i]!) ** 2, 0);
      return -scoreOf(g.apply(current, x)) + prior;
    };
    const starts = [g.x0, g.x0.map((v, i) => v + g.steps[i]!), g.x0.map((v, i) => v - g.steps[i]!)];
    let best = { x: g.x0, fx: Infinity };
    for (const s of starts) {
      const run = nelderMead(cost, s, g.steps, { maxEvals: FIT2_MAX_EVALS, tol: FIT2_TOL });
      evals += run.evals;
      if (run.fx < best.fx) best = { x: run.x, fx: run.fx };
    }
    const candidate = g.apply(current, best.x);
    const next = scoreOf(candidate);
    evals++;
    if (next > base + FIT2_MIN_GAIN) {
      improved.push({ name: g.name, gain: next - base });
      current = candidate;
      base = next;
    }
  }
  return {
    recipe: improved.length ? current : recipe,
    score: base,
    evals,
    groups: improved,
  };
}
