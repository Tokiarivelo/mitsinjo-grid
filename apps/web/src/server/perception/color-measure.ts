import type { KitArchetype, ObjectKit } from '@/lib/object-kit';

/**
 * Measured colours of an object (PF-T2): the 3 kit colours come from the photo pixels inside the object
 * outline, not from the LLM. Pure and deterministic: k-means in CIELAB (perceptual distances) with a
 * farthest-point start, then roles by where each colour sits in the object (roof on top, trunk below…).
 */

/** Pixels of the object: CIELAB triples, linear RGB triples, and vertical position (0 = box top, 1 = bottom). */
export interface ObjectPixels {
  lab: Float32Array;
  linear: Float32Array;
  y: Float32Array;
}

/** Fewer pixels than this inside the outline → not measured (the LLM colours stay). */
export const MIN_MEASURED_PIXELS = 64;
/** Colour groups per object: walls, roof, glass, shadow + one spare. */
export const COLOR_CLUSTERS = 5;
const ITERATIONS = 12;

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const labF = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 / 116) * t + 16 / 116);

/** 8-bit sRGB → linear RGB (0–1). */
export function srgbToLinear(r: number, g: number, b: number): [number, number, number] {
  return [toLinear(r / 255), toLinear(g / 255), toLinear(b / 255)];
}

/** Linear RGB → CIELAB (D65). */
export function linearToLab(r: number, g: number, b: number): [number, number, number] {
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const fx = labF(x);
  const fy = labF(y);
  const fz = labF(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Linear RGB → `#rrggbb`. */
export function linearToHex(r: number, g: number, b: number): string {
  const byte = (c: number) =>
    Math.round(Math.min(1, Math.max(0, toSrgb(c))) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/** Builds `ObjectPixels` from interleaved 8-bit RGB and each pixel's vertical position. */
export function objectPixels(rgb: ArrayLike<number>, y: ArrayLike<number>): ObjectPixels {
  const n = y.length;
  const lab = new Float32Array(n * 3);
  const linear = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const l = srgbToLinear(rgb[i * 3]!, rgb[i * 3 + 1]!, rgb[i * 3 + 2]!);
    linear.set(l, i * 3);
    lab.set(linearToLab(...l), i * 3);
  }
  return { lab, linear, y: Float32Array.from(y) };
}

const dist2 = (p: Float32Array, i: number, c: Float32Array, j: number) => {
  const a = p[i * 3]! - c[j * 3]!;
  const b = p[i * 3 + 1]! - c[j * 3 + 1]!;
  const d = p[i * 3 + 2]! - c[j * 3 + 2]!;
  return a * a + b * b + d * d;
};

/**
 * k-means on CIELAB points. Start: the point nearest the mean, then each next centre = the point farthest
 * from the centres so far (maximin, deterministic, no PRNG). Returns each point's group.
 */
export function kmeansLab(lab: Float32Array, k: number, iterations = ITERATIONS): Uint8Array {
  const n = lab.length / 3;
  const labels = new Uint8Array(n);
  if (n === 0) return labels;
  const groups = Math.max(1, Math.min(k, n, 255));
  const centres = new Float32Array(groups * 3);
  const mean = new Float32Array(3);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) mean[c]! += lab[i * 3 + c]! / n;
  let first = 0;
  for (let i = 1; i < n; i++) if (dist2(lab, i, mean, 0) < dist2(lab, first, mean, 0)) first = i;
  centres.set(lab.subarray(first * 3, first * 3 + 3), 0);
  const nearest = new Float32Array(n).fill(Infinity);
  for (let j = 1; j < groups; j++) {
    let far = 0;
    for (let i = 0; i < n; i++) {
      nearest[i] = Math.min(nearest[i]!, dist2(lab, i, centres, j - 1));
      if (nearest[i]! > nearest[far]!) far = i;
    }
    centres.set(lab.subarray(far * 3, far * 3 + 3), j * 3);
  }
  const sums = new Float64Array(groups * 3);
  const counts = new Uint32Array(groups);
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      for (let j = 1; j < groups; j++) {
        if (dist2(lab, i, centres, j) < dist2(lab, i, centres, best)) best = j;
      }
      if (labels[i] !== best || it === 0) moved = true;
      labels[i] = best;
    }
    if (!moved) break;
    sums.fill(0);
    counts.fill(0);
    for (let i = 0; i < n; i++) {
      const j = labels[i]!;
      counts[j]!++;
      for (let c = 0; c < 3; c++) sums[j * 3 + c]! += lab[i * 3 + c]!;
    }
    for (let j = 0; j < groups; j++) {
      if (counts[j]) for (let c = 0; c < 3; c++) centres[j * 3 + c] = sums[j * 3 + c]! / counts[j]!;
    }
  }
  return labels;
}

/** Where the secondary colour (roof, trunk, stand…) sits in the object box, by archetype. */
const SECONDARY_BAND: Partial<Record<KitArchetype, 'top' | 'bottom'>> = {
  house: 'top',
  building: 'top',
  vehicle: 'top',
  lamp_post: 'top',
  person: 'top',
  tree: 'bottom',
  screen: 'bottom',
  fan: 'bottom',
  panel: 'bottom',
};
const inBand = (band: 'top' | 'bottom' | undefined, y: number) =>
  band === 'top' ? y < 0.4 : band === 'bottom' ? y > 0.7 : false;

interface Group {
  count: number;
  inSecondary: number;
  lightness: number;
  hex: string;
}

/**
 * Object pixels → the kit's 3 colours (PF-T2), or null when too few pixels were measured.
 * main = biggest group outside the secondary band (walls, body, crown); secondary = biggest other group
 * inside that band (roof, trunk, stand), else the next biggest group; accent = darkest group left (glass).
 */
export function measureKitColors(
  px: ObjectPixels,
  archetype: KitArchetype
): ObjectKit['colors'] | null {
  const n = px.y.length;
  if (n < MIN_MEASURED_PIXELS) return null;
  const labels = kmeansLab(px.lab, COLOR_CLUSTERS);
  const band = SECONDARY_BAND[archetype];
  const acc = Array.from({ length: COLOR_CLUSTERS }, () => ({
    count: 0,
    inSecondary: 0,
    l: 0,
    rgb: [0, 0, 0],
  }));
  for (let i = 0; i < n; i++) {
    const g = acc[labels[i]!]!;
    g.count++;
    if (inBand(band, px.y[i]!)) g.inSecondary++;
    g.l += px.lab[i * 3]!;
    for (let c = 0; c < 3; c++) g.rgb[c]! += px.linear[i * 3 + c]!;
  }
  const groups: Group[] = acc
    .filter((g) => g.count > 0)
    .map((g) => ({
      count: g.count,
      inSecondary: g.inSecondary,
      lightness: g.l / g.count,
      hex: linearToHex(g.rgb[0]! / g.count, g.rgb[1]! / g.count, g.rgb[2]! / g.count),
    }));
  const by = (score: (g: Group) => number, from: Group[]) =>
    from.reduce<Group | undefined>(
      (best, g) => (!best || score(g) > score(best) ? g : best),
      undefined
    );

  const main = by((g) => g.count - g.inSecondary, groups)!;
  const rest = groups.filter((g) => g !== main);
  const bandPixels = groups.reduce((s, g) => s + g.inSecondary, 0);
  const inBandBest = by((g) => g.inSecondary, rest);
  const secondary =
    inBandBest && bandPixels > 0 && inBandBest.inSecondary >= 0.05 * bandPixels
      ? inBandBest
      : (by((g) => g.count, rest) ?? main);
  const left = rest.filter((g) => g !== secondary && g.count >= 0.01 * n);
  const accent = by((g) => -g.lightness, left) ?? main;
  return { main: main.hex, secondary: secondary.hex, accent: accent.hex };
}

/** Even-odd point-in-polygon over several rings (photo fractions). */
export function insideRings(
  x: number,
  y: number,
  rings: ReadonlyArray<ReadonlyArray<readonly [number, number]>>
): boolean {
  let inside = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i]!;
      const [xj, yj] = r[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}
