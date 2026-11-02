import 'server-only';

import type { KitArchetype } from '@/lib/object-kit';
import { frontPartIndex, type ObjectRecipe, type PartMask } from '@/lib/object-shape';
import { pathToRings } from '@/lib/vision';
import { insideRings, linearToHex, srgbToLinear } from './color-measure';
import { confidence, mixColor } from './fusion';
import { isWheelPart, type MaskMapGeom } from './mask-geometry';
import { vehicleShell } from './mask-panels';
import type { RgbGrid } from './model-score';
import { pixelBox } from './shape-colors';
import type { PhotoForRegions } from './region';

/** Region grid: 96² cells over the box, the colour sampling budget. */
export const REGION_GRID = 96;

/** Fewer cells than this in a region → too noisy, the role colour stays. */
export const MIN_REGION_PIXELS = 12;

/**
 * How much a box-only mask shrinks for colour sampling (each side): box corners around a round
 * wheel are background, and box edges bleed. Outline masks are used exactly.
 */
export const BOX_REGION_ERODE = 0.2;

export interface RegionMeasure {
  /** Median colour of the region's cells, in linear light (robust to trim and shadows). */
  color: string;
  /** Cells inside the region (drives the fusion confidence). */
  pixels: number;
}

export interface RegionColors {
  /** Per input mask (same order): null when too few cells fell inside. */
  regions: Array<RegionMeasure | null>;
  /** Outline cells outside every mask: null without an outline or too few cells. */
  rest: RegionMeasure | null;
}

interface PreparedMask {
  box: { x0: number; y0: number; x1: number; y1: number };
  rings: Array<Array<readonly [number, number]>>;
}

const median = (values: number[]): number => {
  const s = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

const medianHex = (rs: number[], gs: number[], bs: number[]) =>
  linearToHex(median(rs), median(gs), median(bs));

/**
 * Colours measured per mask region on a box grid (PR-2.8): each cell lands in the first mask
 * containing it (outline-tested, box-eroded without an outline) or in the rest pool (outline
 * cells outside every mask). Pure: same inputs → same colours.
 */
export function measureRegionColors(
  grid: RgbGrid,
  outline: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  masks: ReadonlyArray<PartMask>,
  geom: MaskMapGeom,
  photo: Pick<PhotoForRegions, 'width' | 'height'>,
  box: MaskMapGeom['box']
): RegionColors {
  const prepared: PreparedMask[] = masks.map((m) => {
    const erode = m.outline ? 0 : BOX_REGION_ERODE;
    const ix = m.box.w * erode;
    const iy = m.box.h * erode;
    return {
      box: {
        x0: m.box.x + ix,
        y0: m.box.y + iy,
        x1: m.box.x + m.box.w - ix,
        y1: m.box.y + m.box.h - iy,
      },
      rings: m.outline ? pathToRings(m.outline).filter((r) => r.length >= 3) : [],
    };
  });
  const reds = masks.map((): number[] => []);
  const greens = masks.map((): number[] => []);
  const blues = masks.map((): number[] => []);
  const restR: number[] = [];
  const restG: number[] = [];
  const restB: number[] = [];
  const { left, top, width, height } = pixelBox(photo, box);
  const { cols, rows, rgb } = grid;
  for (let j = 0; j < rows; j++) {
    const photoY = top + ((j + 0.5) / rows) * height;
    const v = photoY / photo.height;
    for (let i = 0; i < cols; i++) {
      const photoX = left + ((i + 0.5) / cols) * width;
      const u = photoX / photo.width;
      if (outline.length > 0 && !insideRings(u, v, outline)) continue;
      const cu = (photoX - geom.crop.left) / geom.crop.width;
      const cv = (photoY - geom.crop.top) / geom.crop.height;
      let hit = -1;
      for (let k = 0; k < prepared.length; k++) {
        const pm = prepared[k]!;
        if (cu < pm.box.x0 || cu > pm.box.x1 || cv < pm.box.y0 || cv > pm.box.y1) continue;
        if (pm.rings.length > 0 && !insideRings(cu, cv, pm.rings)) continue;
        hit = k;
        break;
      }
      const o = (j * cols + i) * 3;
      const [lr, lg, lb] = srgbToLinear(rgb[o]!, rgb[o + 1]!, rgb[o + 2]!);
      if (hit >= 0) {
        reds[hit]!.push(lr);
        greens[hit]!.push(lg);
        blues[hit]!.push(lb);
      } else if (outline.length > 0) {
        restR.push(lr);
        restG.push(lg);
        restB.push(lb);
      }
    }
  }
  return {
    regions: masks.map((_, k) =>
      reds[k]!.length >= MIN_REGION_PIXELS
        ? { color: medianHex(reds[k]!, greens[k]!, blues[k]!), pixels: reds[k]!.length }
        : null
    ),
    rest:
      restR.length >= MIN_REGION_PIXELS
        ? { color: medianHex(restR, restG, restB), pixels: restR.length }
        : null,
  };
}

/** Mask box (crop fractions) → object-fraction rect, for part overlap. */
function maskObjectRect(
  geom: MaskMapGeom,
  box: PartMask['box']
): { x0: number; y0: number; x1: number; y1: number } {
  const W = geom.photoW;
  const H = geom.photoH;
  const px = (cu: number) => geom.crop.left + cu * geom.crop.width;
  const py = (cv: number) => geom.crop.top + cv * geom.crop.height;
  const bw = geom.box.w * W;
  const bh = geom.box.h * H;
  return {
    x0: (px(box.x) - geom.box.x * W) / bw - 0.5,
    x1: (px(box.x + box.w) - geom.box.x * W) / bw - 0.5,
    y0: 0.5 - (py(box.y + box.h) - geom.box.y * H) / bh,
    y1: 0.5 - (py(box.y) - geom.box.y * H) / bh,
  };
}

const inside = (r: { x0: number; y0: number; x1: number; y1: number }, x: number, y: number) =>
  x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

/**
 * Recolours the recipe from its regions (PR-2.8): thin glass/door panels take their mask's
 * colour, the biggest wheel per masked site takes the tyre colour (rims keep their alloy),
 * and the front body — plus a body-unified cabin shell — takes the rest colour. Each colour
 * mixes by its pixel confidence, so thin evidence barely moves the role colour. Returns the
 * recipe unchanged (same reference) when nothing applies. Pure: same inputs → same recipe.
 */
export function withRegionColors(
  archetype: KitArchetype,
  recipe: ObjectRecipe,
  masks: ReadonlyArray<PartMask>,
  measured: RegionColors,
  geom: MaskMapGeom
): ObjectRecipe {
  if (archetype !== 'vehicle' && archetype !== 'house') return recipe;
  const main = recipe.parts[frontPartIndex(recipe)]!;
  const rects = masks.map((m) => maskObjectRect(geom, m.box));
  const shell = archetype === 'vehicle' ? vehicleShell(recipe.parts, main) : null;
  const shellFollows = !!shell && shell.color.toLowerCase() === main.color.toLowerCase();
  const recoloured = new Map<number, string>();
  const applied: string[] = [];
  masks.forEach((mask, k) => {
    const region = measured.regions[k];
    if (!region) return;
    const conf = confidence.colors(region.pixels);
    if (!(conf > 0)) return;
    const rect = rects[k]!;
    if (mask.concept === 'window' || mask.concept === 'door') {
      const before = recoloured.size;
      recipe.parts.forEach((p, i) => {
        if (recoloured.has(i) || p === main || p.shape !== 'box' || p.size[2] > 0.05) return;
        if (!inside(rect, p.at[0], p.at[1])) return;
        recoloured.set(i, mixColor(region.color, p.color, conf));
      });
      if (recoloured.size > before) {
        applied.push(`${mask.concept} ${region.color} (${region.pixels} px)`);
      }
      return;
    }
    if (mask.concept === 'wheel') {
      const sites = recipe.parts
        .map((p, i) => ({ p, i }))
        .filter(
          ({ p, i }) =>
            !recoloured.has(i) && isWheelPart(p, main.at[1]) && inside(rect, p.at[0], p.at[1])
        );
      if (sites.length === 0) return;
      const radii = sites.map(({ p }) => Math.max(p.size[0], p.size[1]) / 2);
      const maxR = Math.max(...radii);
      sites.forEach(({ p, i }, s) => {
        // The biggest wheel per site is the tyre; smaller concentric ones are rims.
        if (radii[s]! >= 0.8 * maxR) recoloured.set(i, mixColor(region.color, p.color, conf));
      });
      applied.push(`${mask.concept} ${region.color} (${region.pixels} px)`);
    }
  });
  if (measured.rest) {
    const conf = confidence.colors(measured.rest.pixels);
    if (conf > 0) {
      const mainIdx = recipe.parts.indexOf(main);
      recoloured.set(mainIdx, mixColor(measured.rest.color, main.color, conf));
      if (shell && shellFollows) {
        recoloured.set(
          recipe.parts.indexOf(shell),
          mixColor(measured.rest.color, shell.color, conf)
        );
      }
      applied.push(`body ${measured.rest.color} (${measured.rest.pixels} px)`);
    }
  }
  if (recoloured.size === 0) return recipe;
  console.info(`[vision] 3D region colours: ${applied.join(', ')}`);
  return {
    ...recipe,
    parts: recipe.parts.map((p, i) =>
      recoloured.has(i) ? { ...p, color: recoloured.get(i)! } : p
    ),
  };
}
