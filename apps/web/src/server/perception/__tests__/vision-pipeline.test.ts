import { describe, expect, it, vi } from 'vitest';
import { MOCK_DETECTIONS } from '../mock';
import type { DetectionResult, SegmentResult } from '../schemas';
import { runVisionPipeline } from '../vision-pipeline';

const meta = (detections = MOCK_DETECTIONS): DetectionResult => ({
  source: 'meta',
  model: 'muse-spark-1.3',
  detections,
});

const fridgeSeg: SegmentResult = {
  source: 'meta',
  model: 'sam-3.1',
  concept: 'fridge',
  imageWidth: 1000,
  imageHeight: 1000,
  instances: [
    { box: { x1: 60, y1: 220, x2: 259, y2: 879 }, outline: 'M0.06 0.22L0.26 0.22L0.26 0.88Z' },
  ],
  count: 1,
  boxCoverage: 0.13,
};

describe('runVisionPipeline (PV-T6)', () => {
  it('Meta: emits boxes first, then outlines refined by SAM', async () => {
    const emit = vi.fn();
    const segmentImage = vi.fn(async (_u: string, concept: string) =>
      concept === 'fridge' ? fridgeSeg : { ...fridgeSeg, concept, instances: [], count: 0 }
    );
    await runVisionPipeline({ detectAppliances: async () => meta(), segmentImage }, 'data:x', emit);

    expect(emit.mock.calls.map((c) => [c[0], c[1].phase])).toEqual([
      ['vision_detections', 'boxes'],
      ['vision_detections', 'outlines'],
    ]);
    const outlines = emit.mock.calls[1]![1];
    expect(outlines.refined).toBe(1);
    expect(outlines.detections[0].outline).toBe('M0.06 0.22L0.26 0.22L0.26 0.88Z');
    expect(segmentImage).toHaveBeenCalledTimes(MOCK_DETECTIONS.length);
  });

  it('mock or fallback answer: boxes only, no SAM call', async () => {
    const emit = vi.fn();
    const segmentImage = vi.fn();
    await runVisionPipeline(
      {
        detectAppliances: async () => ({ ...meta(), source: 'mock', fallback: 'spend_cap' }),
        segmentImage,
      },
      'data:x',
      emit
    );
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0]![1].fallback).toBe('spend_cap');
    expect(segmentImage).not.toHaveBeenCalled();
  });

  it('no appliance on the photo: one empty event, no SAM call', async () => {
    const emit = vi.fn();
    const segmentImage = vi.fn();
    await runVisionPipeline(
      { detectAppliances: async () => meta([]), segmentImage },
      'data:x',
      emit
    );
    expect(emit.mock.calls).toEqual([
      [
        'vision_detections',
        { phase: 'boxes', detections: [], source: 'meta', model: 'muse-spark-1.3' },
      ],
    ]);
    expect(segmentImage).not.toHaveBeenCalled();
  });

  it('an unexpected error becomes vision_error, never a throw', async () => {
    const emit = vi.fn();
    await runVisionPipeline(
      {
        detectAppliances: async () => {
          throw new Error('boom');
        },
        segmentImage: vi.fn(),
      },
      'data:x',
      emit
    );
    expect(emit.mock.calls).toEqual([
      ['vision_error', { code: 'VISION_FAILED', message: 'Appliance detection failed' }],
    ]);
  });
});
