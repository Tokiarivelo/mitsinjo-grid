import type { PerceptionClient } from './client';
import type { ApplianceDetection, NormBox, SegmentResult } from './schemas';

/** Longest wait for one SAM call; past it the Muse box is kept. */
export const SEGMENT_TIMEOUT_MS = 8000;
/** Most SAM calls per photo (one per distinct label), to bound cost and latency. */
export const MAX_SEGMENT_CONCEPTS = 8;
/** Minimum box overlap (IoU) for a SAM instance to belong to a Muse detection. */
export const MATCH_MIN_IOU = 0.3;

/** Intersection over union of two image-fraction boxes (0–1). */
export function iou(a: NormBox, b: NormBox): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

/** SAM box (inclusive pixels) → image fractions; null without image size. */
export function samBoxToNorm(
  box: { x1: number; y1: number; x2: number; y2: number },
  width: number,
  height: number
): NormBox | null {
  if (width <= 0 || height <= 0) return null;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const x1 = clamp(Math.min(box.x1, box.x2) / width);
  const y1 = clamp(Math.min(box.y1, box.y2) / height);
  const x2 = clamp((Math.max(box.x1, box.x2) + 1) / width);
  const y2 = clamp((Math.max(box.y1, box.y2) + 1) / height);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** SAM text prompt for a detection: its label as a short lowercase noun phrase. */
export function conceptOf(d: ApplianceDetection): string {
  return d.label.trim().toLowerCase();
}

/** Resolves to null after `ms` (the client also gets the abort signal). */
async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal).catch(() => null), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Greedy best-IoU matching of SAM instances to the detections that share its concept. */
function matchInstances(
  detections: ApplianceDetection[],
  indices: number[],
  seg: SegmentResult
): Map<number, { box: NormBox; confidence?: number }> {
  const candidates: { det: number; inst: number; score: number; box: NormBox }[] = [];
  seg.instances.forEach((inst, i) => {
    const box = samBoxToNorm(inst.box, seg.imageWidth, seg.imageHeight);
    if (!box) return;
    for (const det of indices) {
      const score = iou(detections[det]!.box, box);
      if (score >= MATCH_MIN_IOU) candidates.push({ det, inst: i, score, box });
    }
  });
  candidates.sort((a, b) => b.score - a.score || a.det - b.det || a.inst - b.inst);

  const out = new Map<number, { box: NormBox; confidence?: number }>();
  const usedInst = new Set<number>();
  for (const c of candidates) {
    if (out.has(c.det) || usedInst.has(c.inst)) continue;
    usedInst.add(c.inst);
    const confidence = seg.instances[c.inst]!.confidence;
    out.set(c.det, { box: c.box, ...(confidence !== undefined ? { confidence } : {}) });
  }
  return out;
}

export interface RefineResult {
  detections: ApplianceDetection[];
  /** Detections whose box SAM refined. */
  refined: number;
  /** Concepts whose SAM call failed, timed out or answered from the mock (box kept). */
  skipped: string[];
}

/**
 * Refines Muse boxes with SAM (PV-T5): one call per distinct label, in parallel, each bounded by
 * `timeoutMs`. A matched detection takes the SAM box (pixel-precise). Failure, timeout, spend cap
 * or a mock answer → the Muse box is kept. Never throws. Masks are not decoded yet: no `outline`.
 */
export async function refineDetections(
  perception: Pick<PerceptionClient, 'segmentImage'>,
  imageUrl: string,
  detections: ApplianceDetection[],
  { timeoutMs = SEGMENT_TIMEOUT_MS, maxConcepts = MAX_SEGMENT_CONCEPTS } = {}
): Promise<RefineResult> {
  const byConcept = new Map<string, number[]>();
  detections.forEach((d, i) => {
    const key = conceptOf(d);
    const list = byConcept.get(key);
    if (list) list.push(i);
    else if (byConcept.size < maxConcepts) byConcept.set(key, [i]);
  });

  const concepts = [...byConcept.keys()];
  const results = await Promise.all(
    concepts.map((concept) =>
      withTimeout((signal) => perception.segmentImage(imageUrl, concept, signal), timeoutMs)
    )
  );

  const out = detections.map((d) => ({ ...d, box: { ...d.box } }));
  const skipped: string[] = [];
  let refined = 0;
  concepts.forEach((concept, k) => {
    const seg = results[k];
    // Only a real SAM answer refines: the mock's boxes belong to another image.
    if (!seg || seg.source !== 'meta' || seg.fallback) {
      skipped.push(concept);
      return;
    }
    for (const [det, match] of matchInstances(out, byConcept.get(concept)!, seg)) {
      const d = out[det]!;
      out[det] = {
        ...d,
        box: match.box,
        ...(d.confidence === undefined && match.confidence !== undefined
          ? { confidence: match.confidence }
          : {}),
      };
      refined += 1;
    }
  });

  return { detections: out, refined, skipped };
}
