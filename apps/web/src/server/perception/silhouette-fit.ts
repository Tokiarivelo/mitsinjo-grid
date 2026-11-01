/**
 * Fit by optimisation (PF-T6): the template parameters whose silhouette best matches the SAM mask.
 * θ = {width, depth, yaw, eave}; houses in a row stay as measured (PF-T3, PF-T4).
 * The model is rendered by a pure rasteriser (orthographic, turned by the yaw) at 128 px in the photo box,
 * scored `J = 1 − IoU + λ·chamfer + μ·prior` and minimised with Nelder–Mead from the PF-T3…T5 estimates.
 * Pure and deterministic; geometry only.
 */
import { kitToRecipe, uniformRoof, type ObjectKit } from '@/lib/object-kit';
import { fitRecipe, MAX_YAW, type ObjectRecipe, type RecipePart } from '@/lib/object-shape';
import { nelderMead } from './nelder-mead';

/** Columns of the fit grid (rows follow the box aspect). */
export const FIT_COLUMNS = 128;
export const FIT_MAX_EVALS = 150;
/** Weight of the edge distance in J. */
const LAMBDA = 0.5;
/** Weight of the pull back to the measured start (keeps unseen values, e.g. depth seen head-on). */
const PRIOR = 0.02;

type Pt = readonly [number, number];
/** A filled grid: 1 = inside. */
export interface Mask {
  cols: number;
  rows: number;
  data: Uint8Array;
}

export const emptyMask = (cols: number, rows: number): Mask => ({
  cols,
  rows,
  data: new Uint8Array(cols * rows),
});

/** Fills `polys` (grid coordinates, even-odd over all of them) into `mask`, pixel centres sampled. */
export function fillPolygons(mask: Mask, polys: ReadonlyArray<ReadonlyArray<Pt>>): void {
  const xs: number[] = [];
  for (let r = 0; r < mask.rows; r++) {
    const y = r + 0.5;
    xs.length = 0;
    for (const p of polys) {
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const [xi, yi] = p[i]!;
        const [xj, yj] = p[j]!;
        if (yi > y !== yj > y) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil(xs[k]! - 0.5));
      const c1 = Math.min(mask.cols - 1, Math.floor(xs[k + 1]! - 0.5));
      for (let c = c0; c <= c1; c++) mask.data[r * mask.cols + c] = 1;
    }
  }
}

/** Convex hull (monotone chain), counter-clockwise. */
export function convexHull(points: ReadonlyArray<Pt>): Pt[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Pt[]) => {
    const h: Pt[] = [];
    for (const q of list) {
      while (h.length >= 2 && cross(h[h.length - 2]!, h[h.length - 1]!, q) <= 0) h.pop();
      h.push(q);
    }
    h.pop();
    return h;
  };
  return [...half(p), ...half([...p].reverse())];
}

const ROUND = 16;
const circle = (y: number, r = 0.5): Array<[number, number, number]> =>
  Array.from({ length: ROUND }, (_, i) => {
    const a = (2 * Math.PI * i) / ROUND;
    return [r * Math.cos(a), y, r * Math.sin(a)];
  });

/** Points of a unit primitive (same as the viewer's `unitPart`) whose hull is its outline. */
function unitPoints(p: RecipePart): Array<[number, number, number]> {
  switch (p.shape) {
    case 'box':
      return [-0.5, 0.5].flatMap((x) =>
        [-0.5, 0.5].flatMap((y) => [-0.5, 0.5].map((z) => [x, y, z] as [number, number, number]))
      );
    case 'prism': {
      const r = Math.min(1, Math.max(0, p.apex ?? 0.5)) - 0.5;
      return [-0.5, 0.5].flatMap((z) => [
        [-0.5, -0.5, z] as [number, number, number],
        [0.5, -0.5, z] as [number, number, number],
        [r, 0.5, z] as [number, number, number],
      ]);
    }
    case 'cylinder':
      return [...circle(-0.5), ...circle(0.5)];
    case 'cone':
      return [...circle(-0.5), [0, 0.5, 0]];
    case 'sphere':
      return [-0.4, -0.2, 0, 0.2, 0.4, -0.5, 0.5].flatMap((y) =>
        circle(y, Math.sqrt(Math.max(0, 0.25 - y * y)))
      );
  }
}

/**
 * Silhouette of a fitted recipe in the photo box (`aspect` = box width / height, pixels): the model's
 * height fills the rows, its width spans `h·aspect` across the columns, centred.
 */
export function renderRecipe(
  recipe: ObjectRecipe,
  aspect: number,
  cols: number,
  rows: number
): Mask {
  const { w, h, d } = recipe.proportions;
  const frameW = h * aspect;
  const cos = Math.cos(recipe.yaw ?? 0);
  const sin = Math.sin(recipe.yaw ?? 0);
  const mask = emptyMask(cols, rows);
  for (const p of recipe.parts) {
    const pts = unitPoints(p).map(([ux, uy, uz]) => {
      let [x, y, z] = [ux, uy, uz];
      if (p.axis === 'x') [x, y] = [-y, x];
      else if (p.axis === 'z') [y, z] = [-z, y];
      x = (x * p.size[0] + p.at[0]) * w;
      y = (y * p.size[1] + p.at[1]) * h;
      z = (z * p.size[2] + p.at[2]) * d;
      const sx = x * cos + z * sin;
      return [((sx + frameW / 2) / frameW) * cols, ((h / 2 - y) / h) * rows] as const;
    });
    fillPolygons(mask, [convexHull(pts)]);
  }
  return mask;
}

/** SAM rings (photo fractions) → mask of the box at `cols` × `rows`. */
export function ringsMask(
  rings: ReadonlyArray<ReadonlyArray<Pt>>,
  box: { x: number; y: number; w: number; h: number },
  cols: number,
  rows: number
): Mask {
  const mask = emptyMask(cols, rows);
  fillPolygons(
    mask,
    rings.map((r) =>
      r.map(([x, y]) => [((x - box.x) / box.w) * cols, ((y - box.y) / box.h) * rows] as const)
    )
  );
  return mask;
}

/** Intersection over union of two masks of the same size (0 when both are empty). */
export function iou(a: Mask, b: Mask): number {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.data.length; i++) {
    inter += a.data[i]! & b.data[i]!;
    union += a.data[i]! | b.data[i]!;
  }
  return union ? inter / union : 0;
}

const isEdge = (m: Mask, c: number, r: number) => {
  if (!m.data[r * m.cols + c]) return false;
  if (c === 0 || r === 0 || c === m.cols - 1 || r === m.rows - 1) return true;
  const k = r * m.cols + c;
  return !m.data[k - 1] || !m.data[k + 1] || !m.data[k - m.cols] || !m.data[k + m.cols];
};

/** Distance (px, 3-4 chamfer / 3) from every pixel to the nearest edge pixel of `m`. */
export function edgeDistance(m: Mask): Float32Array {
  const { cols, rows } = m;
  const dist = new Float32Array(cols * rows).fill(1e6);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) if (isEdge(m, c, r)) dist[r * cols + c] = 0;
  const relax = (k: number, n: number, cost: number) => {
    if (dist[n]! + cost < dist[k]!) dist[k] = dist[n]! + cost;
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = r * cols + c;
      if (c > 0) relax(k, k - 1, 3);
      if (r > 0) {
        relax(k, k - cols, 3);
        if (c > 0) relax(k, k - cols - 1, 4);
        if (c < cols - 1) relax(k, k - cols + 1, 4);
      }
    }
  }
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const k = r * cols + c;
      if (c < cols - 1) relax(k, k + 1, 3);
      if (r < rows - 1) {
        relax(k, k + cols, 3);
        if (c < cols - 1) relax(k, k + cols + 1, 4);
        if (c > 0) relax(k, k + cols - 1, 4);
      }
    }
  }
  for (let i = 0; i < dist.length; i++) dist[i] = dist[i]! / 3;
  return dist;
}

/** Mean distance of `m`'s edge pixels to the target edges, share of the grid diagonal (1 when no edge). */
export function chamfer(m: Mask, targetDistance: Float32Array): number {
  let sum = 0;
  let n = 0;
  for (let r = 0; r < m.rows; r++) {
    for (let c = 0; c < m.cols; c++) {
      if (isEdge(m, c, r)) {
        sum += targetDistance[r * m.cols + c]!;
        n++;
      }
    }
  }
  return n ? sum / n / Math.hypot(m.cols, m.rows) : 1;
}

export interface SilhouetteFit {
  recipe: ObjectRecipe;
  /** IoU of the fitted silhouette with the SAM mask (0–1, 2 decimals). */
  iou: number;
  /** IoU before the fit (the PF-T3…T5 estimates), for the logs. */
  iouStart: number;
  evals: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Best template parameters for `kit` against the SAM `rings` (photo fractions) of `box`. `aspect` = box
 * width / height (pixels); `yaw0` = PF-T5 estimate; `canYaw` = straight-edged archetype (a tree is never
 * turned). Houses: the eave moves. ≤ `FIT_MAX_EVALS` evaluations, stop when ΔJ < 1e-3. Null when the
 * mask is empty.
 */
export function fitSilhouette({
  kit,
  rings,
  box,
  aspect,
  yaw0 = 0,
  canYaw,
}: {
  kit: ObjectKit;
  rings: ReadonlyArray<ReadonlyArray<Pt>>;
  box: { x: number; y: number; w: number; h: number };
  aspect: number;
  yaw0?: number;
  canYaw: boolean;
}): SilhouetteFit | null {
  if (!(aspect > 0) || !rings.length) return null;
  const cols = FIT_COLUMNS;
  const rows = clamp(Math.round(cols / aspect), 32, 2 * cols);
  const target = ringsMask(rings, box, cols, rows);
  if (!target.data.some((v) => v)) return null;
  const targetDistance = edgeDistance(target);

  const house = kit.archetype === 'house';
  // Houses in a row stay as measured (PF-T3 gables, PF-T4 period): a flat outline must not gain gables.
  const roof = house ? (kit.roof ?? uniformRoof(Math.max(1, kit.details?.units ?? 1))) : null;
  const base: ObjectKit = roof ? { ...kit, roof } : kit;
  const eaveLo = roof ? Math.max(...roof.gables.map((g) => g.top)) + 0.05 : 0;
  const build = (x: number[]): ObjectRecipe => {
    const [lw, ld, yawRaw, eaveRaw] = x;
    const k: ObjectKit = roof
      ? { ...base, roof: { ...roof, eave: clamp(eaveRaw ?? roof.eave, eaveLo, 0.9) } }
      : base;
    const yaw = canYaw ? clamp(yawRaw ?? 0, -MAX_YAW, MAX_YAW) : 0;
    const fitted = fitRecipe(kitToRecipe(k), aspect, yaw);
    const sw = Math.exp(clamp(lw!, -0.7, 0.7));
    const sd = Math.exp(clamp(ld!, -1.2, 1.2));
    const p = fitted.proportions;
    const w = p.w * sw;
    const d = p.d * sd;
    const max = Math.max(w, p.h, d);
    return {
      ...fitted,
      proportions: {
        w: clamp(w / max, 0.01, 1),
        h: clamp(p.h / max, 0.01, 1),
        d: clamp(d / max, 0.01, 1),
      },
    };
  };
  const x0 = [0, 0, canYaw ? yaw0 : 0, ...(roof ? [roof.eave] : [])];
  const score = (x: number[]) => {
    const m = renderRecipe(build(x), aspect, cols, rows);
    const prior = x[0]! ** 2 + x[1]! ** 2 + (x[2]! - x0[2]!) ** 2;
    return 1 - iou(m, target) + LAMBDA * chamfer(m, targetDistance) + PRIOR * prior;
  };
  const steps = [0.15, 0.3, canYaw ? 0.15 : 0, ...(roof ? [0.08] : [])];
  // A fixed coordinate (yaw of a tree) gets no step and stays put.
  const free = steps.map((s, i) => (s > 0 ? i : -1)).filter((i) => i >= 0);
  const expand = (y: number[]) => {
    const x = [...x0];
    free.forEach((i, k) => (x[i] = y[k]!));
    return x;
  };
  const run = nelderMead(
    (y) => score(expand(y)),
    free.map((i) => x0[i]!),
    free.map((i) => steps[i]!),
    { maxEvals: FIT_MAX_EVALS, tol: 1e-3 }
  );
  const recipe = build(expand(run.x));
  return {
    recipe,
    iou: round2(iou(renderRecipe(recipe, aspect, cols, rows), target)),
    iouStart: round2(iou(renderRecipe(build(x0), aspect, cols, rows), target)),
    evals: run.evals,
  };
}
