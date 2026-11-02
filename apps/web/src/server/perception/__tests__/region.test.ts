// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import type { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));
const { hostVisionImage } = vi.hoisted(() => ({ hostVisionImage: vi.fn() }));
vi.mock('@/server/storage/media', () => ({ hostVisionImage }));

import type { VisionRegion } from '@/lib/vision';
import { POST } from '@/app/api/vision/route';
import { classifyLabel } from '../detect';
import { MockPerceptionBackend } from '../mock';
import {
  cropBoxToImage,
  cropRegion,
  paddedBounds,
  pickRegionDetection,
  regionQuestion,
  runRegionPipeline,
} from '../region';
import type { DetectionResult, SegmentResult } from '../schemas';

const square: VisionRegion = {
  id: 'shape-1',
  points: [
    [0.4, 0.4],
    [0.6, 0.4],
    [0.6, 0.6],
    [0.4, 0.6],
  ],
  hint: 'pompe',
};

const photo = async () => {
  const buffer = await sharp({
    create: { width: 200, height: 100, channels: 3, background: { r: 20, g: 20, b: 20 } },
  })
    .jpeg()
    .toBuffer();
  return { buffer, width: 200, height: 100 };
};

describe('region geometry (PV-T8)', () => {
  it('pads the shape bounds and clamps them to the photo', () => {
    const b = paddedBounds(square.points);
    expect(b.x).toBeCloseTo(0.37);
    expect(b.w).toBeCloseTo(0.26);
    const edge = paddedBounds([
      [0, 0],
      [0.1, 0],
      [0.1, 0.1],
    ]);
    expect(edge.x).toBe(0);
    expect(edge.y).toBe(0);
  });

  it('maps a crop box back to the photo', () => {
    expect(
      cropBoxToImage({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.2, y: 0.4, w: 0.4, h: 0.2 })
    ).toEqual({ x: 0.4, y: 0.5, w: 0.2, h: 0.1 });
  });

  it('picks the model box that overlaps the shape, none when it looked elsewhere', () => {
    const crop = { x: 0.3, y: 0.3, w: 0.4, h: 0.4 };
    const shape = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 };
    const inside = {
      id: 'a',
      label: 'Pump',
      category: 'water_pump' as const,
      box: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
    };
    const away = { ...inside, id: 'b', box: { x: 0, y: 0, w: 0.05, h: 0.05 } };
    expect(pickRegionDetection([away, inside], crop, shape)?.id).toBe('a');
    expect(pickRegionDetection([away], crop, shape)).toBeNull();
  });

  it('crops around the shape as a JPEG with the outside dimmed', async () => {
    const out = await cropRegion(await photo(), square);
    expect(out.dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
    const img = sharp(Buffer.from(out.dataUrl.split(',')[1]!, 'base64'));
    const meta = await img.metadata();
    expect(meta.width).toBe(52);
    expect(meta.height).toBe(26);
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => data[(y * info.width + x) * info.channels]!;
    // Corner (outside the shape) is whitened; centre (inside) keeps the dark photo.
    expect(px(0, 0)).toBeGreaterThan(120);
    expect(px(26, 13)).toBeLessThan(60);
  });

  it('hint is quoted data in the question; FR words classify', () => {
    expect(regionQuestion('a "fridge"')).toContain(`"a 'fridge'"`);
    expect(regionQuestion()).not.toContain('operator says');
    expect(classifyLabel('Pompe à eau')).toEqual({ kind: 'appliance', category: 'water_pump' });
    expect(classifyLabel('frigo')).toEqual({ kind: 'appliance', category: 'fridge' });
    expect(classifyLabel('maison')).toMatchObject({ kind: 'appliance', category: 'other' });
    expect(classifyLabel('car')).toEqual({ kind: 'scenery', scenery: 'vehicle' });
  });
});

describe('runRegionPipeline (PV-T8)', () => {
  const metaFound = (detections: DetectionResult['detections']): DetectionResult => ({
    source: 'meta',
    model: 'muse',
    detections,
  });

  it('Meta: one Muse call per shape on its crop, then SAM outlines; ids = shape ids', async () => {
    const emit = vi.fn();
    const identifyRegion = vi.fn(async (_url: string, hint?: string) =>
      hint === 'pompe'
        ? metaFound([
            {
              id: 'det-1',
              label: 'Water pump',
              category: 'water_pump',
              box: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
            },
          ])
        : metaFound([])
    );
    const seg: SegmentResult = {
      source: 'meta',
      model: 'sam',
      concept: 'pump',
      imageWidth: 200,
      imageHeight: 100,
      instances: [
        { box: { x1: 82, y1: 41, x2: 117, y2: 58 }, outline: 'M0.41 0.41L0.59 0.41L0.5 0.59Z' },
      ],
      count: 1,
      boxCoverage: 0.03,
    };
    const segmentImage = vi.fn(async () => seg);
    const other: VisionRegion = { ...square, id: 'shape-2', hint: undefined };
    await runRegionPipeline(
      { identifyRegion, segmentImage },
      await photo(),
      'https://r2/x.jpg',
      [square, other],
      emit
    );

    expect(identifyRegion).toHaveBeenCalledTimes(2);
    expect(identifyRegion.mock.calls[0]![0]).toMatch(/^data:image\/jpeg/);
    // Concept normalized (PR-2.21): SAM gets 'pump', not the raw 'Water pump' label.
    expect(segmentImage).toHaveBeenCalledWith('https://r2/x.jpg', 'pump', expect.anything());
    const [boxes, outlines] = emit.mock.calls.map((c) => c[1]);
    expect(emit.mock.calls.map((c) => c[0])).toEqual(['vision_regions', 'vision_regions']);
    expect(boxes.phase).toBe('boxes');
    expect(boxes.results[0].detection).toMatchObject({
      id: 'shape-1',
      label: 'Water pump',
      manual: true,
    });
    expect(boxes.results[1]).toEqual({ regionId: 'shape-2' });
    expect(outlines.phase).toBe('outlines');
    expect(outlines.results[0].detection.outline).toBe(seg.instances[0]!.outline);
  });

  it('mock: classifies the hint, no SAM; no hint → not identified', async () => {
    const emit = vi.fn();
    const mock = new MockPerceptionBackend();
    const perception = {
      identifyRegion: async (u: string, h?: string) => ({
        ...(await mock.identifyRegion(u, h)).result,
        source: 'mock' as const,
        model: 'mock',
      }),
      segmentImage: vi.fn(),
    };
    await runRegionPipeline(
      perception,
      await photo(),
      'data:x',
      [square, { ...square, id: 's2', hint: '' }],
      emit
    );
    expect(emit).toHaveBeenCalledTimes(1);
    const data = emit.mock.calls[0]![1];
    expect(data.results[0].detection).toMatchObject({
      label: 'pompe',
      category: 'water_pump',
      manual: true,
    });
    expect(data.results[1].detection).toBeUndefined();
    expect(perception.segmentImage).not.toHaveBeenCalled();
  });

  it('undecodable photo: the whole image is sent; an exception becomes vision_error', async () => {
    const emit = vi.fn();
    const identifyRegion = vi.fn<(url: string, hint?: string) => Promise<DetectionResult>>(
      async () => metaFound([])
    );
    await runRegionPipeline(
      { identifyRegion, segmentImage: vi.fn() },
      null,
      'data:full',
      [square],
      emit
    );
    expect(identifyRegion.mock.calls[0]![0]).toBe('data:full');
    const boom = vi.fn();
    await runRegionPipeline(
      { identifyRegion: async () => Promise.reject(new Error('x')), segmentImage: vi.fn() },
      null,
      'data:full',
      [square],
      boom
    );
    expect(boom).toHaveBeenCalledWith(
      'vision_error',
      expect.objectContaining({ code: 'VISION_FAILED' })
    );
  });
});

describe('POST /api/vision with regions', () => {
  const post = async (regions: string) => {
    const form = new FormData();
    form.append(
      'image',
      new Blob([new Uint8Array((await photo()).buffer)], { type: 'image/jpeg' }),
      'p.jpg'
    );
    form.append('regions', regions);
    return POST(
      new Request('http://localhost/api/vision', {
        method: 'POST',
        body: form,
      }) as unknown as NextRequest
    );
  };

  it('offline: streams vision_regions for the drawn shape', async () => {
    const res = await post(JSON.stringify([square]));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('event: vision_regions');
    expect(text).toContain('"regionId":"shape-1"');
    expect(text).not.toContain('event: vision_detections');
    expect(text).toContain('event: done');
  });

  it('rejects invalid regions with 400', async () => {
    expect((await post('not json')).status).toBe(400);
    expect((await post('[]')).status).toBe(400);
    expect((await post(JSON.stringify([{ id: 'a', points: [[0, 0]] }]))).status).toBe(400);
  });
});
