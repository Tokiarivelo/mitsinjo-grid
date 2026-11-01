/**
 * Flat renderer (PR-0.1): a recipe drawn at the photo view as colour, so the shape loop can compare it with
 * the photo crop. Orthographic, turned by the yaw, same frame as `renderRecipe` (the model's height fills the
 * rows, its width spans `h·aspect` across the columns, centred). One ray per pixel, exact primitives in
 * their unit space, nearest hit wins (z-buffer), Lambert shade of the part colour.
 * Pure and deterministic; geometry and colours only.
 */
import type { ObjectRecipe, RecipePart } from '@/lib/object-shape';
import { hexToRgb } from './color-measure';
import {
  applyTransform,
  emptyMask,
  partTransform,
  type Mask,
  type PartTransform,
} from './silhouette-fit';

type V3 = [number, number, number];

/** Light direction in view space (x right, y up, z to the camera): upper left, in front. */
export const FLAT_LIGHT: Readonly<V3> = normalize([-0.35, 0.6, 0.72]);
/** Share of the colour kept on faces turned away from the light. */
export const FLAT_AMBIENT = 0.4;

export interface FlatRender {
  /** 1 = the model covers the pixel. */
  mask: Mask;
  /** sRGB, 3 bytes per pixel, row-major; 0 outside the mask. */
  rgb: Uint8ClampedArray;
  /** Index of the visible part per pixel, −1 outside. */
  part: Int16Array;
  /** Unshaded colour of each part (`#rrggbb`), by part index. */
  colors: readonly string[];
}

function normalize([x, y, z]: Readonly<V3>): V3 {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

const dot = (a: Readonly<V3>, b: Readonly<V3>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Inverse of a row-major 3 × 3 matrix, or null when flat. */
function invert(m: readonly number[]): number[] | null {
  const [a, b, c, d, e, f, g, h, i] = m as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const k = 1 / det;
  return [
    A * k,
    (c * h - b * i) * k,
    (b * f - c * e) * k,
    B * k,
    (a * i - c * g) * k,
    (c * d - a * f) * k,
    C * k,
    (b * g - a * h) * k,
    (a * e - b * d) * k,
  ];
}

const mul = (m: readonly number[], [x, y, z]: Readonly<V3>): V3 => [
  m[0]! * x + m[1]! * y + m[2]! * z,
  m[3]! * x + m[4]! * y + m[5]! * z,
  m[6]! * x + m[7]! * y + m[8]! * z,
];

/** Ray span inside a convex solid, with the outward normal (unit space) where the ray enters. */
interface Span {
  tin: number;
  tout: number;
  n: V3 | null;
}

/** Keeps the part of the span where `n·p ≤ c`. */
function clipPlane(s: Span, o: V3, d: V3, n: V3, c: number): void {
  const den = dot(n, d);
  const num = c - dot(n, o);
  if (Math.abs(den) < 1e-12) {
    if (num < 0) s.tout = -Infinity;
    return;
  }
  const t = num / den;
  if (den < 0) {
    if (t > s.tin) {
      s.tin = t;
      s.n = n;
    }
  } else if (t < s.tout) s.tout = t;
}

/** Keeps the part of the span where `a t² + b t + c ≤ 0`; `grad` gives the normal at a point. */
function clipQuadric(s: Span, a: number, b: number, c: number, at: (t: number) => V3): void {
  let pieces: Array<[number, number]>;
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) < 1e-12) pieces = c <= 0 ? [[-Infinity, Infinity]] : [];
    else pieces = b > 0 ? [[-Infinity, -c / b]] : [[-c / b, Infinity]];
  } else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) pieces = a > 0 ? [] : [[-Infinity, Infinity]];
    else {
      // Stable roots (no cancellation when `a` is tiny: a long cylinder seen almost along its axis).
      const q = -(b + (b < 0 ? -1 : 1) * Math.sqrt(disc)) / 2;
      const roots = q === 0 ? [0, 0] : [q / a, c / q];
      const [t1, t2] = roots.sort((p, r) => p - r) as [number, number];
      pieces =
        a > 0
          ? [[t1, t2]]
          : [
              [-Infinity, t1],
              [t2, Infinity],
            ];
    }
  }
  // The solid is convex inside the slabs already clipped: at most one piece overlaps the span.
  const hit = pieces.find(([p, q]) => Math.max(p, s.tin) < Math.min(q, s.tout));
  if (!hit) {
    s.tout = -Infinity;
    return;
  }
  if (hit[0] > s.tin) {
    s.tin = hit[0];
    s.n = at(hit[0]);
  }
  s.tout = Math.min(s.tout, hit[1]);
}

const H = 0.5;

/** Ray (unit space) through one unit primitive (1 × 1 × 1 bounds, as the viewer's `unitPart`). */
function intersect(p: RecipePart, o: V3, d: V3): Span | null {
  const s: Span = { tin: -Infinity, tout: Infinity, n: null };
  const pt = (t: number): V3 => [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
  clipPlane(s, o, d, [0, 1, 0], H);
  clipPlane(s, o, d, [0, -1, 0], H);
  switch (p.shape) {
    case 'box':
    case 'prism':
      clipPlane(s, o, d, [0, 0, 1], H);
      clipPlane(s, o, d, [0, 0, -1], H);
      if (p.shape === 'box') {
        clipPlane(s, o, d, [1, 0, 0], H);
        clipPlane(s, o, d, [-1, 0, 0], H);
      } else {
        // Ridge at x = r, slopes down to the bottom corners.
        const r = Math.min(1, Math.max(0, p.apex ?? 0.5)) - H;
        clipPlane(s, o, d, [-1, r + H, 0], H - H * (r + H));
        clipPlane(s, o, d, [1, H - r, 0], H - H * (H - r));
      }
      break;
    case 'cylinder':
      clipQuadric(
        s,
        d[0] ** 2 + d[2] ** 2,
        2 * (o[0] * d[0] + o[2] * d[2]),
        o[0] ** 2 + o[2] ** 2 - H * H,
        (t) => {
          const [x, , z] = pt(t);
          return [x, 0, z];
        }
      );
      break;
    case 'cone': {
      // Radius (0.5 − y) / 2: base 0.5 at y = −0.5, apex at y = 0.5.
      const q0 = (H - o[1]) / 2;
      const q1 = -d[1] / 2;
      clipQuadric(
        s,
        d[0] ** 2 + d[2] ** 2 - q1 * q1,
        2 * (o[0] * d[0] + o[2] * d[2] - q0 * q1),
        o[0] ** 2 + o[2] ** 2 - q0 * q0,
        (t) => {
          const [x, y, z] = pt(t);
          return [x, (H - y) / 4, z];
        }
      );
      break;
    }
    case 'sphere':
      clipQuadric(s, dot(d, d), 2 * dot(o, d), dot(o, o) - H * H, pt);
      break;
  }
  return s.n && s.tin < s.tout ? s : null;
}

/** Depth difference under which two hits are the same surface. */
const TIE = 1e-6;

const CORNERS: V3[] = [-H, H].flatMap((x) =>
  [-H, H].flatMap((y) => [-H, H].map((z) => [x, y, z] as V3))
);

/** Extra camera turn for a look around the model: yaw (rad, around y), pitch (rad, + = seen from above). */
export interface FlatView {
  yaw: number;
  pitch: number;
}

/** The ¾ view of the contact sheet: turned 35°, seen 20° from above. */
export const THREE_QUARTER: FlatView = { yaw: (35 * Math.PI) / 180, pitch: (20 * Math.PI) / 180 };

/** `t` turned by the view: pitch·yaw·t (both rows of the matrix and the translation). */
function turned(t: PartTransform, { yaw, pitch }: FlatView): PartTransform {
  const [cy, sy, cp, sp] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];
  const col = (x: number, y: number, z: number): V3 => {
    const [x1, z1] = [x * cy + z * sy, -x * sy + z * cy];
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
  };
  const { m } = t;
  const c = [0, 1, 2].map((j) => col(m[j]!, m[3 + j]!, m[6 + j]!));
  return {
    m: [0, 1, 2].flatMap((i) => c.map((v) => v[i]!)),
    t: col(...t.t),
  };
}

/**
 * The recipe drawn on a `cols` × `rows` grid. Default: at the photo view (`aspect` = box width / height in
 * pixels, same frame as `renderRecipe`). With `view`: turned around the model and framed on its bounds
 * (contact sheet), `aspect` unused.
 */
export function renderFlat(
  recipe: ObjectRecipe,
  aspect: number,
  cols: number,
  rows: number,
  view?: FlatView
): FlatRender {
  const n = cols * rows;
  const mask = emptyMask(cols, rows);
  const rgb = new Uint8ClampedArray(n * 3);
  const part = new Int16Array(n).fill(-1);
  const depth = new Float64Array(n).fill(Infinity);
  const transforms = recipe.parts.map((p) => {
    const t = partTransform(recipe, p);
    return view ? turned(t, view) : t;
  });
  // Frame: centre and size in view units.
  let [cx, cy, fw, fh] = [0, 0, recipe.proportions.h * aspect, recipe.proportions.h];
  if (view) {
    const pts = transforms.flatMap((t) => CORNERS.map((c) => applyTransform(t, c)));
    const [x0, x1] = [Math.min(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[0]))];
    const [y0, y1] = [Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[1]))];
    const unit = Math.max((x1 - x0) / cols, (y1 - y0) / rows) * 1.1; // 10 % margin
    [cx, cy, fw, fh] = [(x0 + x1) / 2, (y0 + y1) / 2, unit * cols, unit * rows];
  }
  const toCol = (x: number) => ((x - cx + fw / 2) / fw) * cols - 0.5;
  const toRow = (y: number) => ((cy + fh / 2 - y) / fh) * rows - 0.5;
  const EYE = 100; // in front of every part (recipes stay within ±2)

  recipe.parts.forEach((p, k) => {
    const tf = transforms[k]!;
    const inv = invert(tf.m);
    if (!inv) return;
    const box = CORNERS.map((c) => applyTransform(tf, c));
    const c0 = Math.max(0, Math.floor(Math.min(...box.map((b) => toCol(b[0])))));
    const c1 = Math.min(cols - 1, Math.ceil(Math.max(...box.map((b) => toCol(b[0])))));
    const r0 = Math.max(0, Math.floor(Math.min(...box.map((b) => toRow(b[1])))));
    const r1 = Math.min(rows - 1, Math.ceil(Math.max(...box.map((b) => toRow(b[1])))));
    // Ray toward −z in view space, mapped to the unit space of the part.
    const d = mul(inv, [0, 0, -1]);
    const [cr, cg, cb] = hexToRgb(p.color);
    for (let r = r0; r <= r1; r++) {
      const y = cy + fh / 2 - ((r + 0.5) / rows) * fh;
      for (let c = c0; c <= c1; c++) {
        const x = cx - fw / 2 + ((c + 0.5) / cols) * fw;
        const o = mul(inv, [x - tf.t[0], y - tf.t[1], EYE - tf.t[2]]);
        const hit = intersect(p, o, d);
        const i = r * cols + c;
        // Ties (a wheel flush with the body front) go to the later part: details come after the body.
        if (!hit || hit.tin > depth[i]! + TIE) continue;
        depth[i] = hit.tin;
        // Normals map by the inverse transpose.
        const [nx, ny, nz] = hit.n!;
        const nv = normalize([
          inv[0]! * nx + inv[3]! * ny + inv[6]! * nz,
          inv[1]! * nx + inv[4]! * ny + inv[7]! * nz,
          inv[2]! * nx + inv[5]! * ny + inv[8]! * nz,
        ]);
        const shade = FLAT_AMBIENT + (1 - FLAT_AMBIENT) * Math.max(0, dot(nv, FLAT_LIGHT));
        mask.data[i] = 1;
        part[i] = k;
        rgb[i * 3] = cr * shade;
        rgb[i * 3 + 1] = cg * shade;
        rgb[i * 3 + 2] = cb * shade;
      }
    }
  });
  return { mask, rgb, part, colors: recipe.parts.map((p) => p.color) };
}
