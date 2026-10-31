import type { Box, SegmentInstance } from './schemas';

/** Raw mask of one SAM instance: a `height × width` raster over the instance box, still encoded. */
export interface SamMask {
  encoding: 'one_bit' | 'lossless';
  height: number;
  width: number;
  /** Base85 payload including its marker (`!` one_bit, `~` lossless). Not decoded here. */
  payload: string;
}

/** `key=value;key=value` fields of a token. */
function tokenFields(body: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const pair of body.split(';')) {
    const eq = pair.indexOf('=');
    if (eq > 0) fields.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  return fields;
}

/** `data=H,W,<marker>payload` → mask, or null when malformed. The payload alphabet has no `,` `;` `|`. */
export function parseSamMask(body: string): SamMask | null {
  const data = tokenFields(body).get('data');
  const m = data?.match(/^(\d+),(\d+),([!~])(.*)$/s);
  if (!m) return null;
  const height = Number(m[1]);
  const width = Number(m[2]);
  if (!(height > 0 && width > 0)) return null;
  return {
    encoding: m[3] === '!' ? 'one_bit' : 'lossless',
    height,
    width,
    payload: m[3]! + m[4]!,
  };
}

/**
 * Reads SAM 3.1 text output: `<0f>0<|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..;c=..|><|mask;x=0;y=0;data=H,W,!..|>,1<|box;...|>...`
 * Boxes (inclusive pixels) and, aligned with them, the still-encoded masks (`null` when absent or malformed).
 */
export function parseSamOutput(text: string): {
  imageWidth: number;
  imageHeight: number;
  instances: SegmentInstance[];
  masks: (SamMask | null)[];
} {
  const instances: SegmentInstance[] = [];
  const masks: (SamMask | null)[] = [];
  let imageWidth = 0;
  let imageHeight = 0;

  for (const match of text.matchAll(/<\|box;([^|]*)\|>(?:<\|mask;([^|]*)\|>)?/g)) {
    const fields = new Map<string, number>();
    for (const [k, v] of tokenFields(match[1]!)) {
      const n = Number(v);
      if (v !== '' && Number.isFinite(n)) fields.set(k, n);
    }
    const x1 = fields.get('x1');
    const y1 = fields.get('y1');
    const x2 = fields.get('x2');
    const y2 = fields.get('y2');
    if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) continue;

    imageWidth = fields.get('w') ?? imageWidth;
    imageHeight = fields.get('h') ?? imageHeight;
    const c = fields.get('c');
    instances.push({
      box: { x1, y1, x2, y2 },
      ...(c !== undefined ? { confidence: Math.min(1, Math.max(0, c)) } : {}),
    });
    masks.push(match[2] !== undefined ? parseSamMask(match[2]) : null);
  }

  return { imageWidth, imageHeight, instances, masks };
}

/**
 * Share of the image covered by the union of boxes (0–1). x2/y2 are inclusive pixels.
 * Exact union via coordinate compression: fine for the few dozen boxes SAM returns.
 */
export function boxUnionCoverage(boxes: Box[], width: number, height: number): number {
  if (width <= 0 || height <= 0 || boxes.length === 0) return 0;
  const clipped = boxes
    .map((b) => ({
      x1: Math.max(0, Math.min(b.x1, b.x2)),
      y1: Math.max(0, Math.min(b.y1, b.y2)),
      x2: Math.min(width, Math.max(b.x1, b.x2) + 1),
      y2: Math.min(height, Math.max(b.y1, b.y2) + 1),
    }))
    .filter((b) => b.x2 > b.x1 && b.y2 > b.y1);

  const xs = [...new Set(clipped.flatMap((b) => [b.x1, b.x2]))].sort((a, b) => a - b);
  const ys = [...new Set(clipped.flatMap((b) => [b.y1, b.y2]))].sort((a, b) => a - b);

  let area = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const cx = xs[i]!;
      const cy = ys[j]!;
      if (clipped.some((b) => b.x1 <= cx && cx < b.x2 && b.y1 <= cy && cy < b.y2)) {
        area += (xs[i + 1]! - cx) * (ys[j + 1]! - cy);
      }
    }
  }
  return Math.min(1, area / (width * height));
}
