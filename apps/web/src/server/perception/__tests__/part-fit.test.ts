// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { ObjectRecipe, RecipePart } from '@/lib/object-shape';
import { hexToRgb } from '../color-measure';
import { renderFlat, type FlatRender } from '../flat-render';
import { photoTerms, scoreRender, type RgbGrid } from '../model-score';
import {
  FIT2_MAX_EVALS,
  fitPartParams,
  hasPartGroups,
  preparePartFit,
  type FitTerms,
} from '../part-fit';
import { emptyMask, type Mask } from '../silhouette-fit';

const SKY = '#a0c0e0';
const part = (over: Partial<RecipePart>): RecipePart => ({
  shape: 'box',
  at: [0, 0, 0],
  size: [0.6, 0.6, 0.6],
  color: '#3060c0',
  ...over,
});
const recipe = (parts: RecipePart[]): ObjectRecipe => ({
  proportions: { w: 1, h: 1, d: 1 },
  parts,
});

/**
 * Fit terms whose photo is the truth render itself (flat part colours over sky): the truth is the
 * optimum by construction, so a perturbed start must move back toward it.
 */
function termsOf(truth: ObjectRecipe, aspect = 1, cols = 96): { terms: FitTerms; photo: RgbGrid } {
  const rows = Math.round(cols / aspect);
  const render = renderFlat(truth, aspect, cols, rows);
  const rgb = new Uint8Array(cols * rows * 3);
  const outline = emptyMask(cols, rows);
  for (let i = 0; i < cols * rows; i++) {
    const k = render.part[i]!;
    rgb.set(hexToRgb(k < 0 ? SKY : render.colors[k]!), i * 3);
    outline.data[i] = render.mask.data[i]!;
  }
  const photo = { cols, rows, rgb };
  return { terms: { aspect, cols, rows, outline, photo: photoTerms(photo, outline) }, photo };
}

const scoreOf = (r: ObjectRecipe, terms: FitTerms, outline: Mask, render?: FlatRender) =>
  scoreRender(render ?? renderFlat(r, terms.aspect, terms.cols, terms.rows), outline, terms.photo)
    .score;

const BODY = '#b0302f';
const TYRE = '#1a1a1a';
const GLASS = '#9fb6c9';

const carTruth = () =>
  recipe([
    part({ at: [0, -0.05, 0], size: [1, 0.5, 0.9], color: BODY, front: true }),
    part({
      shape: 'cylinder',
      axis: 'z',
      at: [0.3, -0.3, 0],
      size: [0.26, 0.26, 0.12],
      color: TYRE,
    }),
    part({
      shape: 'cylinder',
      axis: 'z',
      at: [-0.3, -0.3, 0],
      size: [0.26, 0.26, 0.12],
      color: TYRE,
    }),
    part({ at: [-0.03, 0.32, 0], size: [0.52, 0.36, 0.82], color: GLASS }),
  ]);

describe('fitPartParams (PR-2.9)', () => {
  it('grows undersized wheels back toward the photo and raises the score', () => {
    const truth = carTruth();
    const { terms } = termsOf(truth);
    const start = recipe(
      truth.parts.map((p, i) =>
        i === 0 || i === 3 ? p : { ...p, size: [0.19, 0.19, 0.12] as RecipePart['size'] }
      )
    );
    const before = scoreOf(start, terms, terms.outline);
    const fit = fitPartParams(start, 'vehicle', terms);
    expect(fit.groups.map((g) => g.name)).toContain('wheels');
    const radii = [fit.recipe.parts[1]!.size[0], fit.recipe.parts[2]!.size[0]];
    expect(Math.min(...radii)).toBeGreaterThan(0.19);
    expect(Math.max(...radii)).toBeLessThanOrEqual(0.27);
    expect(fit.score).toBeGreaterThan(before);
    // Base + per group (3 starts × max evals + acceptance).
    expect(fit.evals).toBeLessThanOrEqual(1 + 2 * (3 * FIT2_MAX_EVALS + 1));
  });

  it('returns the recipe itself when nothing improves the score', () => {
    const truth = carTruth();
    const { terms } = termsOf(truth);
    const fit = fitPartParams(truth, 'vehicle', terms);
    expect(fit.groups).toEqual([]);
    expect(fit.recipe).toBe(truth);
  });

  it('is deterministic: same input, same fitted recipe', () => {
    const truth = carTruth();
    const { terms } = termsOf(truth);
    const start = recipe(
      truth.parts.map((p, i) =>
        i === 1 ? { ...p, size: [0.19, 0.19, 0.12] as RecipePart['size'] } : p
      )
    );
    const a = fitPartParams(start, 'vehicle', terms);
    const b = fitPartParams(start, 'vehicle', terms);
    expect(a.recipe).toEqual(b.recipe);
    expect(a.score).toBe(b.score);
    expect(a.evals).toBe(b.evals);
  });

  it('moves a low wall/roof boundary back up on houses', () => {
    const truth = recipe([
      part({ at: [0, -0.15, 0], size: [1, 0.7, 1], color: '#c9a86a', front: true }),
      part({ shape: 'prism', at: [0, 0.35, 0], size: [1, 0.3, 1], color: '#4a4a52' }),
    ]);
    const { terms } = termsOf(truth);
    const start = recipe([
      part({ at: [0, -0.175, 0], size: [1, 0.65, 1], color: '#c9a86a', front: true }),
      part({ shape: 'prism', at: [0, 0.325, 0], size: [1, 0.35, 1], color: '#4a4a52' }),
    ]);
    const before = scoreOf(start, terms, terms.outline);
    const fit = fitPartParams(start, 'house', terms);
    expect(fit.groups.map((g) => g.name)).toEqual(['eave']);
    const wall = fit.recipe.parts[0]!;
    expect(wall.at[1] + wall.size[1] / 2).toBeGreaterThan(0.15);
    expect(fit.score).toBeGreaterThan(before);
  });

  it('finds no groups on archetypes without tunable parts', () => {
    const tree = recipe([
      part({
        shape: 'sphere',
        at: [0, 0.16, 0],
        size: [0.96, 0.64, 0.96],
        color: '#2f7a2f',
        front: true,
      }),
      part({ shape: 'cylinder', at: [0, -0.28, 0], size: [0.14, 0.44, 0.14], color: '#6a4a2a' }),
    ]);
    expect(hasPartGroups('tree', tree)).toBe(false);
    expect(hasPartGroups('vehicle', carTruth())).toBe(true);
  });

  it('preparePartFit is null without an outline', async () => {
    const photo = { buffer: Buffer.alloc(0), width: 320, height: 240 };
    await expect(preparePartFit(photo, { box: { x: 0, y: 0, w: 1, h: 1 } })).resolves.toBeNull();
  });
});
