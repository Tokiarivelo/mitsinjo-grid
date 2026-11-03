import type { ObjectRecipe, RecipePart } from '@/lib/object-shape';
import { DOOR_COLOR, type Elevation } from './facade-house';
import { renderFlat, type FlatRender, type FlatView, type ViewFrame } from './flat-render';
import { edgeTolerance } from './model-score';
import type { NormBox } from './schemas';
import { distanceTo, emptyMask, iou, ringsMask, type Mask } from './silhouette-fit';

/**
 * Elevation render and score (PG-T1, PG-T2): the model drawn straight on, in the frame of the
 * validated 2D elevation, then compared with what SAM measured on that drawing — silhouette,
 * structure edges, one IoU per concept (wall, roof, chimney, door, window) and matched openings.
 * Per-stage numbers let the staged loop (PG-T16) judge one piece at a time. Pure, deterministic.
 */

type Ring = ReadonlyArray<readonly [number, number]>;

/** Concepts compared on an elevation, in paint order (a window wins over its wall). */
export const ELEVATION_CONCEPTS = ['wall', 'plinth', 'roof', 'chimney', 'door', 'window'] as const;
export type ElevationConcept = (typeof ELEVATION_CONCEPTS)[number];

/** Build stages scored separately (PV-G loop, house). */
export const ELEVATION_STAGES = ['massing', 'roof', 'openings', 'accessories'] as const;
export type ElevationStage = (typeof ELEVATION_STAGES)[number];

/** Straight on the front; side = seen from +x with the front on the image left (as Muse Image draws it). */
export const ELEVATION_VIEWS: Record<'front' | 'side', FlatView> = {
  front: { yaw: 0, pitch: 0 },
  side: { yaw: -Math.PI / 2, pitch: 0 },
};

/** Default grid height of an elevation render, pixels. */
export const ELEVATION_ROWS = 128;
/** Centre error (share of the elevation width) at which an opening's position counts for nothing. */
export const MAX_CENTRE_ERROR = 0.1;
/** Weights of the 0–100 elevation score. */
export const ELEVATION_WEIGHTS = {
  iou: 0.3,
  edge: 0.2,
  roof: 0.15,
  openings: 0.25,
  accessories: 0.1,
} as const;

const right = (b: NormBox) => b.x + b.w;
const bottomOf = (b: NormBox) => b.y + b.h;

/** Square-pixel grid of an image of `aspect` (width / height). */
export function elevationGrid(aspect: number, rows = ELEVATION_ROWS) {
  return { cols: Math.max(1, Math.round(rows * aspect)), rows };
}

/** Everything the elevation shows of the object (body + chimneys), image fractions. */
export function elevationBox(e: Elevation): NormBox {
  const x0 = Math.min(e.left, ...e.chimneys.map((c) => c.x));
  const x1 = Math.max(e.right, ...e.chimneys.map(right));
  const y0 = Math.min(e.top, ...e.chimneys.map((c) => c.y));
  return { x: x0, y: y0, w: x1 - x0, h: e.bottom - y0 };
}

/**
 * Which concept a recipe part draws: its `kind` when set (a step counts as base, a frame is
 * not scored yet), else guessed — roofs are slopes, glass is a window, brick a chimney, the
 * door paint a door, the main body the wall; anything else is not scored by concept.
 */
export function partConcept(p: RecipePart): ElevationConcept | null {
  if (p.kind === 'step') return 'plinth';
  if (p.kind)
    return (ELEVATION_CONCEPTS as readonly string[]).includes(p.kind)
      ? (p.kind as ElevationConcept)
      : null;
  if (p.shape === 'prism' || p.shape === 'hip') return 'roof';
  if (p.material === 'glass') return 'window';
  if (p.material === 'brick') return 'chimney';
  if (p.color.toLowerCase() === DOOR_COLOR && p.material === 'wood') return 'door';
  if (p.front) return 'wall';
  return null;
}

/**
 * A window or door on a side wall (its thin axis is x): the front elevation only sees its edge,
 * so it counts as wall there and is never a built opening (regression: the live loop removed
 * the side windows to « fix » the front score, 2026-11-03).
 */
export function sideFacing(p: RecipePart): boolean {
  const c = partConcept(p);
  return (c === 'window' || c === 'door') && p.size[0] < p.size[2];
}

export interface ElevationRender extends FlatRender {
  cols: number;
  rows: number;
}

/**
 * The recipe straight on, in the elevation image's frame: one scale for both axes (proportions
 * errors stay visible), model height = the measured object height, feet on its ground line,
 * centred on its box. The recipe's own yaw is ignored (the drawing has none).
 */
export function renderElevation(
  recipe: ObjectRecipe,
  e: Elevation,
  side: 'front' | 'side' = 'front',
  rows = ELEVATION_ROWS
): ElevationRender {
  const { cols } = elevationGrid(e.aspect, rows);
  const box = elevationBox(e);
  const frameOf = ({ x0, x1, y0, y1 }: { x0: number; x1: number; y0: number; y1: number }) => {
    const fh = (y1 - y0) / box.h;
    const fw = fh * e.aspect;
    const frame: ViewFrame = {
      fh,
      fw,
      cy: bottomOf(box) * fh + y0 - fh / 2,
      cx: (x0 + x1) / 2 + fw / 2 - (box.x + box.w / 2) * fw,
    };
    return frame;
  };
  const flat = renderFlat(
    { ...recipe, yaw: 0 },
    e.aspect,
    cols,
    rows,
    ELEVATION_VIEWS[side],
    frameOf
  );
  return { ...flat, cols, rows };
}

/** What the elevation shows, rasterised on the render grid. */
export interface ElevationTarget {
  cols: number;
  rows: number;
  /** Concept index (`ELEVATION_CONCEPTS`) per pixel, −1 = background. */
  label: Int8Array;
  /** Openings measured on the drawing, image fractions. */
  openings: Array<{ concept: 'window' | 'door'; box: NormBox }>;
}

function fillRect(label: Int8Array, cols: number, rows: number, b: NormBox, value: number) {
  const c0 = Math.max(0, Math.round(b.x * cols));
  const c1 = Math.min(cols, Math.round(right(b) * cols));
  const r0 = Math.max(0, Math.round(b.y * rows));
  const r1 = Math.min(rows, Math.round(bottomOf(b) * rows));
  for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) label[r * cols + c] = value;
}

/**
 * Target label map from the measured elevation: walls under the eave, the base (plinth, steps), the roof (its SAM outline
 * inside the roof band when given, else the band), then chimneys, doors and windows on top.
 */
export function elevationTarget(
  e: Elevation,
  rows = ELEVATION_ROWS,
  roofRings?: ReadonlyArray<Ring>
): ElevationTarget {
  const { cols } = elevationGrid(e.aspect, rows);
  const label = new Int8Array(cols * rows).fill(-1);
  const idx = (c: ElevationConcept) => ELEVATION_CONCEPTS.indexOf(c);
  fillRect(
    label,
    cols,
    rows,
    { x: e.wallLeft, y: e.eave, w: e.wallRight - e.wallLeft, h: e.bottom - e.eave },
    idx('wall')
  );
  if (e.eave > e.top) {
    const band: NormBox = { x: e.left, y: e.top, w: e.right - e.left, h: e.eave - e.top };
    if (roofRings?.length) {
      const m = ringsMask(roofRings, { x: 0, y: 0, w: 1, h: 1 }, cols, rows);
      const inBand = new Int8Array(cols * rows);
      fillRect(inBand, cols, rows, band, 1);
      for (let i = 0; i < label.length; i++) if (m.data[i] && inBand[i]) label[i] = idx('roof');
    } else fillRect(label, cols, rows, band, idx('roof'));
  }
  if (e.plinth) fillRect(label, cols, rows, e.plinth, idx('plinth'));
  for (const st of e.steps) fillRect(label, cols, rows, st, idx('plinth'));
  for (const c of e.chimneys) fillRect(label, cols, rows, c, idx('chimney'));
  for (const d of e.doors) fillRect(label, cols, rows, d, idx('door'));
  for (const w of e.windows) fillRect(label, cols, rows, w, idx('window'));
  return {
    cols,
    rows,
    label,
    openings: [
      ...e.windows.map((box) => ({ concept: 'window' as const, box })),
      ...e.doors.map((box) => ({ concept: 'door' as const, box })),
    ],
  };
}

/** Concept label per render pixel (−1 = background or an unscored part). */
export function renderLabels(recipe: ObjectRecipe, render: FlatRender): Int8Array {
  const byPart = recipe.parts.map((p) => {
    const c = sideFacing(p) ? 'wall' : partConcept(p);
    return c ? ELEVATION_CONCEPTS.indexOf(c) : -1;
  });
  const out = new Int8Array(render.part.length).fill(-1);
  for (let i = 0; i < out.length; i++) {
    const k = render.part[i]!;
    if (k >= 0) out[i] = byPart[k]!;
  }
  return out;
}

/** Pixels where the label changes toward the right or down neighbour (structure lines). */
function labelEdges(label: Int8Array, cols: number, rows: number): Mask {
  const m = emptyMask(cols, rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const v = label[i]!;
      if ((c + 1 < cols && label[i + 1] !== v) || (r + 1 < rows && label[i + cols] !== v))
        m.data[i] = 1;
    }
  return m;
}

/** Share of `a`'s set pixels within `tol` px of `b`'s (1 when `a` is empty). */
function near(a: Mask, bDist: Float32Array, tol: number): number {
  let n = 0;
  let hit = 0;
  for (let i = 0; i < a.data.length; i++) {
    if (!a.data[i]) continue;
    n++;
    if (bDist[i]! <= tol) hit++;
  }
  return n ? hit / n : 1;
}

const conceptMask = (label: Int8Array, cols: number, rows: number, k: number): Mask => {
  const m = emptyMask(cols, rows);
  for (let i = 0; i < label.length; i++) if (label[i] === k) m.data[i] = 1;
  return m;
};

/** Visible pixel bounds of each window / door part, image fractions. */
function renderOpenings(
  recipe: ObjectRecipe,
  render: ElevationRender
): Array<{ concept: 'window' | 'door'; box: NormBox }> {
  const { cols, rows } = render;
  const out: Array<{ concept: 'window' | 'door'; box: NormBox }> = [];
  recipe.parts.forEach((p, k) => {
    const concept = partConcept(p);
    if ((concept !== 'window' && concept !== 'door') || sideFacing(p)) return;
    let [c0, c1, r0, r1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (let i = 0; i < render.part.length; i++) {
      if (render.part[i] !== k) continue;
      const c = i % cols;
      const r = (i - c) / cols;
      c0 = Math.min(c0, c);
      c1 = Math.max(c1, c);
      r0 = Math.min(r0, r);
      r1 = Math.max(r1, r);
    }
    if (c1 < c0) return;
    out.push({
      concept,
      box: { x: c0 / cols, y: r0 / rows, w: (c1 + 1 - c0) / cols, h: (r1 + 1 - r0) / rows },
    });
  });
  return out;
}

export interface OpeningMatch {
  target: number;
  render: number;
  matched: number;
  /** Mean centre distance of matched pairs, share of the elevation width. */
  centreError: number;
  /** Mean |ln(area ratio)| of matched pairs. */
  sizeError: number;
  /** 0–1: F1 of the counts, weighted by the position error. */
  score: number;
}

/**
 * Openings matched one to one, same concept, cheapest centre distance first (greedy, stable
 * order); a pair counts when the centres are within the target opening's larger side.
 */
export function matchOpenings(
  target: ReadonlyArray<{ concept: string; box: NormBox }>,
  render: ReadonlyArray<{ concept: string; box: NormBox }>,
  aspect: number,
  width: number
): OpeningMatch {
  const centre = (b: NormBox) => [(b.x + b.w / 2) * aspect, b.y + b.h / 2] as const;
  const pairs: Array<{ t: number; r: number; d: number }> = [];
  target.forEach((t, ti) =>
    render.forEach((r, ri) => {
      if (t.concept !== r.concept) return;
      const [tx, ty] = centre(t.box);
      const [rx, ry] = centre(r.box);
      const d = Math.hypot(tx - rx, ty - ry);
      if (d <= Math.max(t.box.w * aspect, t.box.h)) pairs.push({ t: ti, r: ri, d });
    })
  );
  pairs.sort((a, b) => a.d - b.d || a.t - b.t || a.r - b.r);
  const usedT = new Set<number>();
  const usedR = new Set<number>();
  let dSum = 0;
  let sSum = 0;
  for (const p of pairs) {
    if (usedT.has(p.t) || usedR.has(p.r)) continue;
    usedT.add(p.t);
    usedR.add(p.r);
    dSum += p.d;
    const a = target[p.t]!.box;
    const b = render[p.r]!.box;
    sSum += Math.abs(Math.log(Math.max(1e-6, b.w * b.h) / Math.max(1e-6, a.w * a.h)));
  }
  const matched = usedT.size;
  const total = target.length + render.length;
  const centreError = matched ? dSum / matched / Math.max(1e-6, width * aspect) : 0;
  const sizeError = matched ? sSum / matched : 0;
  const f1 = total ? (2 * matched) / total : 1;
  const pos = Math.max(0, 1 - centreError / MAX_CENTRE_ERROR);
  return {
    target: target.length,
    render: render.length,
    matched,
    centreError,
    sizeError,
    score: f1 * (0.7 + 0.3 * pos),
  };
}

export interface ElevationScore {
  /** Silhouette IoU (every concept + unscored parts vs the measured object). */
  iou: number;
  /** F1 of structure lines (concept borders) within `edgeTolerance` px. */
  edgeF1: number;
  /** IoU per concept present on the drawing or the render. */
  concepts: Partial<Record<ElevationConcept, number>>;
  openings: OpeningMatch;
  /** 0–1 per build stage (massing = walls, roof, openings, accessories = chimneys). */
  stages: Record<ElevationStage, number>;
  /** 0–100, higher = closer to the drawing. */
  score: number;
}

/** A score with the grids it was measured on (diff image, stage prompt). */
export type ScoredElevation = ElevationScore & { render: ElevationRender; target: ElevationTarget };

const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

/** The recipe's front elevation against the measured drawing. */
export function scoreElevation(
  recipe: ObjectRecipe,
  e: Elevation,
  { rows = ELEVATION_ROWS, roofRings }: { rows?: number; roofRings?: ReadonlyArray<Ring> } = {}
): ScoredElevation {
  const render = renderElevation(recipe, e, 'front', rows);
  const target = elevationTarget(e, rows, roofRings);
  const { cols } = target;
  const got = renderLabels(recipe, render);
  // A base the drawing does not show (SAM found none; the model's is inferred) is wall foot,
  // not a miss: scored as wall (live 2026-11-02).
  const plinthK = ELEVATION_CONCEPTS.indexOf('plinth');
  if (!target.label.includes(plinthK)) {
    const wallK = ELEVATION_CONCEPTS.indexOf('wall');
    for (let i = 0; i < got.length; i++) if (got[i] === plinthK) got[i] = wallK;
  }
  const silT = emptyMask(cols, rows);
  for (let i = 0; i < silT.data.length; i++) silT.data[i] = target.label[i]! >= 0 ? 1 : 0;
  const tol = edgeTolerance(cols);
  const eT = labelEdges(target.label, cols, rows);
  const eR = labelEdges(
    got.map((v, i) => (v < 0 && render.mask.data[i] ? 99 : v)) as Int8Array,
    cols,
    rows
  );
  const precision = near(eR, distanceTo(eT), tol);
  const recall = near(eT, distanceTo(eR), tol);
  const edgeF1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const concepts: Partial<Record<ElevationConcept, number>> = {};
  ELEVATION_CONCEPTS.forEach((c, k) => {
    const a = conceptMask(target.label, cols, rows, k);
    const b = conceptMask(got, cols, rows, k);
    if (a.data.some((v) => v) || b.data.some((v) => v)) concepts[c] = round(iou(a, b));
  });
  const openings = matchOpenings(
    target.openings,
    renderOpenings(recipe, render),
    e.aspect,
    e.right - e.left
  );
  const silhouette = iou(render.mask, silT);
  const stages: Record<ElevationStage, number> = {
    // Walls, and the base when the drawing or the model has one.
    massing:
      concepts.plinth === undefined
        ? (concepts.wall ?? silhouette)
        : ((concepts.wall ?? silhouette) + concepts.plinth) / 2,
    roof: concepts.roof ?? 1,
    openings: openings.score,
    accessories: concepts.chimney ?? 1,
  };
  const W = ELEVATION_WEIGHTS;
  const score =
    100 *
    (W.iou * silhouette +
      W.edge * edgeF1 +
      W.roof * stages.roof +
      W.openings * stages.openings +
      W.accessories * stages.accessories);
  return {
    iou: round(silhouette),
    edgeF1: round(edgeF1),
    concepts,
    openings: {
      ...openings,
      centreError: round(openings.centreError),
      sizeError: round(openings.sizeError),
      score: round(openings.score),
    },
    stages: Object.fromEntries(Object.entries(stages).map(([k, v]) => [k, round(v)])) as Record<
      ElevationStage,
      number
    >,
    score: Math.round(score),
    render,
    target,
  };
}

/** One log line: score, silhouette, edges, stages, openings (live logs and `make facade-e2e`). */
export function formatElevationScore(s: ElevationScore): string {
  const stages = ELEVATION_STAGES.map((k) => `${k} ${s.stages[k].toFixed(2)}`).join(' · ');
  return `elevation ${s.score}/100 (IoU ${s.iou.toFixed(2)}, edges ${s.edgeF1.toFixed(2)}; ${stages}; openings ${s.openings.matched}/${s.openings.target} drawn, ${s.openings.render} built)`;
}

/** Diff colours: drawn and built (grey), drawn only = missing (red), built only = extra (blue). */
export const DIFF_COLORS = {
  both: [150, 150, 150],
  missing: [220, 40, 40],
  extra: [40, 90, 220],
  wrong: [240, 170, 0],
  none: [255, 255, 255],
} as const;

/**
 * Diff image of a score on its grid (sRGB, row-major): same concept = grey, wrong concept =
 * amber, drawn only = red, built only = blue. What the stage prompt (PG-T15) shows Spark.
 */
export function elevationDiff(
  recipe: ObjectRecipe,
  s: { render: ElevationRender; target: ElevationTarget }
): { cols: number; rows: number; rgb: Uint8ClampedArray } {
  const { cols, rows, label } = s.target;
  const got = renderLabels(recipe, s.render);
  const rgb = new Uint8ClampedArray(cols * rows * 3);
  for (let i = 0; i < label.length; i++) {
    const t = label[i]!;
    const built = s.render.mask.data[i] === 1;
    const g = got[i]!;
    const c =
      t >= 0 && built
        ? g === t
          ? DIFF_COLORS.both
          : DIFF_COLORS.wrong
        : t >= 0
          ? DIFF_COLORS.missing
          : built
            ? DIFF_COLORS.extra
            : DIFF_COLORS.none;
    rgb.set(c, i * 3);
  }
  return { cols, rows, rgb };
}
