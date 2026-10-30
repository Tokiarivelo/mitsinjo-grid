import type { Box, SegmentInstance } from './schemas';

/**
 * Reads SAM 3.1 text output: `<0f>0<|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..;c=..|><|mask;...|>,1<|box;...|>...`
 * Only boxes are read; masks are left out (their encoding is not needed for counts and coverage).
 */
export function parseSamOutput(text: string): {
  imageWidth: number;
  imageHeight: number;
  instances: SegmentInstance[];
} {
  const instances: SegmentInstance[] = [];
  let imageWidth = 0;
  let imageHeight = 0;

  for (const match of text.matchAll(/<\|box;([^|]*)\|>/g)) {
    const fields = new Map<string, number>();
    for (const pair of match[1]!.split(';')) {
      const [k, v] = pair.split('=');
      const n = Number(v);
      if (k && Number.isFinite(n)) fields.set(k, n);
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
  }

  return { imageWidth, imageHeight, instances };
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
