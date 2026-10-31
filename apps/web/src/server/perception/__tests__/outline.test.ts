import { describe, expect, it, vi } from 'vitest';
import { MAX_DETECTIONS } from '../detect';
import { iou, refineDetections, samBoxToNorm } from '../outline';
import { boxUnionCoverage, parseSamOutput } from '../parse-sam';
import type { ApplianceDetection, SegmentResult } from '../schemas';

// Recorded sam-3.1 shape (masks shortened): two instances on a 1920 × 1280 photo.
const SAM_TEXT =
  '<0f>0<|box;x1=1179;y1=585;x2=1900;y2=1071;w=1920;h=1280;c=0.96|><|mask;x=0;y=0;c=0.96;data=487,722,!!!!$q@|>,' +
  '1<|box;x1=16;y1=586;x2=748;y2=1094;w=1920;h=1280;c=0.94|><|mask;x=0;y=0;c=0.94;data=509,733,!!!!4P|>';

function samResult(concept: string, text = SAM_TEXT): SegmentResult {
  const { imageWidth, imageHeight, instances } = parseSamOutput(text);
  return {
    source: 'meta',
    model: 'sam-3.1',
    concept,
    imageWidth,
    imageHeight,
    instances,
    count: instances.length,
    boxCoverage: boxUnionCoverage(
      instances.map((i) => i.box),
      imageWidth,
      imageHeight
    ),
  };
}

const det = (id: string, label: string, box: ApplianceDetection['box']): ApplianceDetection => ({
  id,
  label,
  category: 'fridge',
  box,
});

// Muse boxes near the two SAM instances (grid precision), plus a lamp elsewhere.
const left = det('det-1', 'Fridge', { x: 0.01, y: 0.45, w: 0.38, h: 0.41 });
const right = det('det-2', 'fridge', { x: 0.62, y: 0.46, w: 0.37, h: 0.38 });
const lamp = det('det-3', 'Lamp', { x: 0.45, y: 0.02, w: 0.05, h: 0.05 });

describe('box helpers', () => {
  it('iou', () => {
    const a = { x: 0, y: 0, w: 0.5, h: 0.5 };
    expect(iou(a, a)).toBeCloseTo(1);
    expect(iou(a, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 })).toBe(0);
    expect(iou(a, { x: 0.25, y: 0, w: 0.5, h: 0.5 })).toBeCloseTo(1 / 3);
  });

  it('samBoxToNorm counts inclusive pixels and clamps', () => {
    expect(samBoxToNorm({ x1: 0, y1: 0, x2: 9, y2: 4 }, 10, 10)).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 0.5,
    });
    expect(samBoxToNorm({ x1: 0, y1: 0, x2: 50, y2: 50 }, 10, 10)).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
    expect(samBoxToNorm({ x1: 0, y1: 0, x2: 1, y2: 1 }, 0, 10)).toBeNull();
  });
});

describe('refineDetections (PV-T5)', () => {
  it('one SAM call per distinct label, in parallel; matched boxes take the SAM box', async () => {
    const segmentImage = vi.fn(async (_url: string, concept: string) =>
      concept === 'fridge' ? samResult(concept) : samResult(concept, '')
    );
    const out = await refineDetections({ segmentImage }, 'data:x', [left, right, lamp]);

    expect(segmentImage.mock.calls.map((c) => c[1])).toEqual(['fridge', 'lamp']);
    expect(out.refined).toBe(2);
    expect(out.skipped).toEqual([]);
    const [l, r, lp] = out.detections;
    expect(l!.box).toEqual(samBoxToNorm({ x1: 16, y1: 586, x2: 748, y2: 1094 }, 1920, 1280));
    expect(r!.box).toEqual(samBoxToNorm({ x1: 1179, y1: 585, x2: 1900, y2: 1071 }, 1920, 1280));
    expect(l!.confidence).toBe(0.94);
    expect(lp).toEqual(lamp); // no SAM instance → Muse box kept
    expect(out.detections.every((d) => d.outline === undefined)).toBe(true);
  });

  it('keeps the Muse box when SAM times out', async () => {
    vi.useFakeTimers();
    try {
      let aborted = false;
      const segmentImage = vi.fn(
        (_u: string, _c: string, signal?: AbortSignal) =>
          new Promise<SegmentResult>((resolve) => {
            signal?.addEventListener('abort', () => {
              aborted = true;
            });
            setTimeout(() => resolve(samResult('fridge')), 60_000);
          })
      );
      const pending = refineDetections({ segmentImage }, 'data:x', [left], { timeoutMs: 8000 });
      await vi.advanceTimersByTimeAsync(8000);
      const out = await pending;
      expect(aborted).toBe(true);
      expect(out.detections).toEqual([left]);
      expect(out.refined).toBe(0);
      expect(out.skipped).toEqual(['fridge']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores mock or fallback answers and rejected calls (their boxes belong to another image)', async () => {
    const answers: Record<string, () => Promise<SegmentResult>> = {
      fridge: async () => ({ ...samResult('fridge'), source: 'mock', fallback: 'provider_error' }),
      lamp: async () => {
        throw new Error('boom');
      },
    };
    const out = await refineDetections({ segmentImage: (_u, c) => answers[c]!() }, 'data:x', [
      left,
      lamp,
    ]);
    expect(out.detections).toEqual([left, lamp]);
    expect(out.skipped.sort()).toEqual(['fridge', 'lamp']);
  });

  it('bounds the number of SAM calls; unmatched low-overlap boxes stay', async () => {
    const many = Array.from({ length: MAX_DETECTIONS }, (_, i) =>
      det(`det-${i}`, `thing ${i}`, { x: 0.4, y: 0.1, w: 0.05, h: 0.05 })
    );
    const segmentImage = vi.fn(async (_u: string, c: string) => samResult(c));
    const out = await refineDetections({ segmentImage }, 'data:x', many, { maxConcepts: 3 });
    expect(segmentImage).toHaveBeenCalledTimes(3);
    expect(out.refined).toBe(0);
    expect(out.detections).toEqual(many);
  });
});
