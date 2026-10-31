// @vitest-environment node
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import type { ObjectRecipe, ShapeTarget } from '@/lib/object-shape';
vi.mock('server-only', () => ({}));
import { runObjectShape } from '../object-shape';
import type { ShapeResult } from '../schemas';

const target: ShapeTarget = {
  id: 'det-1',
  label: 'Fridge',
  category: 'fridge',
  box: { x: 0.1, y: 0.1, w: 0.2, h: 0.6 },
};
const tall: ObjectRecipe = {
  proportions: { w: 0.5, h: 1, d: 0.5 },
  parts: [{ shape: 'box', at: [0, 0, 0], size: [1, 1, 1], color: '#eeeeee', front: true }],
};
const meta = (recipe: ObjectRecipe | null, extra: Partial<ShapeResult> = {}): ShapeResult => ({
  recipe,
  source: 'meta',
  model: 'muse-spark-1.3',
  ...extra,
});
const client = (out: ShapeResult) => ({ describeShape: vi.fn().mockResolvedValue(out) });

async function photo() {
  const buffer = await sharp({
    create: { width: 200, height: 100, channels: 3, background: { r: 200, g: 200, b: 200 } },
  })
    .jpeg()
    .toBuffer();
  return { buffer, width: 200, height: 100 };
}

describe('runObjectShape (PV-T9)', () => {
  it('Spark recipe that fits the photo → recipe mode, sent a crop with label and category', async () => {
    const p = client(meta(tall));
    // Box on a 200×100 photo: 40×60 px → aspect 2/3: the width follows the photo.
    const out = await runObjectShape(p, await photo(), 'data:full', target);
    expect(out).toEqual({
      detectionId: 'det-1',
      mode: 'recipe',
      recipe: { ...tall, proportions: { w: 2 / 3, h: 1, d: 0.5 } },
      source: 'meta',
      model: 'muse-spark-1.3',
    });
    const [url, subject, signal] = p.describeShape.mock.calls[0]!;
    expect(url).toMatch(/^data:image\/jpeg;base64,/);
    expect(url).not.toBe('data:full');
    expect(subject).toEqual({ label: 'Fridge', category: 'fridge', aspect: 2 / 3 });
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('recipe with wrong proportions is fitted to the photo box, not rejected', async () => {
    const wide = { ...tall, proportions: { w: 1, h: 0.1, d: 0.5 } };
    const p = client(meta(wide));
    const out = await runObjectShape(p, await photo(), 'data:full', target);
    expect(out.mode).toBe('recipe');
    // Box 40×60 px → width / height 2/3, sent to Spark too.
    expect(out.recipe!.proportions.w / out.recipe!.proportions.h).toBeCloseTo(2 / 3);
    expect(p.describeShape.mock.calls[0]![1]).toMatchObject({ aspect: 2 / 3 });
  });

  it('almost empty recipe → silhouette « no_body »', async () => {
    const flat: ObjectRecipe = {
      ...tall,
      parts: [
        { shape: 'box', at: [0, 0, 0], size: [1, 0.01, 0.01], color: '#888888' },
        { shape: 'box', at: [0, 0.4, 0], size: [0.01, 0.2, 1], color: '#888888' },
      ],
    };
    const out = await runObjectShape(client(meta(flat)), await photo(), 'data:full', target);
    expect(out).toMatchObject({ mode: 'silhouette', reason: 'no_body', source: 'meta' });
    expect(out.recipe).toBeUndefined();
  });

  it('a tiny object (lamp post, ~20 px wide) is sent as an upscaled crop', async () => {
    const big = await sharp({
      create: { width: 1280, height: 951, channels: 3, background: { r: 90, g: 120, b: 160 } },
    })
      .jpeg()
      .toBuffer();
    const p = client(meta(tall));
    await runObjectShape(p, { buffer: big, width: 1280, height: 951 }, 'data:full', {
      ...target,
      label: 'lamp post',
      category: 'lamp',
      box: { x: 0.443, y: 0.487, w: 0.0156, h: 0.1083 },
    });
    const url = p.describeShape.mock.calls[0]![0] as string;
    const meta2 = await sharp(Buffer.from(url.split(',')[1]!, 'base64')).metadata();
    expect(Math.max(meta2.width!, meta2.height!)).toBeGreaterThanOrEqual(640);
  });

  it('unreadable reply → silhouette « malformed »', async () => {
    const out = await runObjectShape(client(meta(null)), null, 'data:full', target);
    expect(out).toMatchObject({ mode: 'silhouette', reason: 'malformed' });
  });

  it('Meta failure or spend cap (mock answered) → silhouette, not the mock recipe', async () => {
    for (const fallback of ['provider_error', 'spend_cap'] as const) {
      const out = await runObjectShape(
        client({ recipe: tall, source: 'mock', model: 'mock-perception-v1', fallback }),
        null,
        'data:full',
        target
      );
      expect(out).toMatchObject({ mode: 'silhouette', reason: fallback, fallback });
    }
  });

  it('mock mode → its recipe, no quality check; whole photo sent without pixels', async () => {
    const wide = { ...tall, proportions: { w: 1, h: 0.1, d: 0.5 } };
    const p = client({ recipe: wide, source: 'mock', model: 'mock-perception-v1' });
    // Mock recipes are not fitted either.
    const out = await runObjectShape(p, null, 'data:full', target);
    expect(out).toMatchObject({ mode: 'recipe', recipe: wide, source: 'mock' });
    expect(p.describeShape.mock.calls[0]![0]).toBe('data:full');
  });

  it('aborts Spark after the timeout and never throws', async () => {
    let seen: AbortSignal | undefined;
    const p = {
      describeShape: vi.fn((_u: string, _t: unknown, signal?: AbortSignal) => {
        seen = signal;
        return Promise.reject(new Error('boom'));
      }),
    };
    const out = await runObjectShape(p, null, 'data:full', target, undefined, 5);
    expect(out).toMatchObject({ mode: 'silhouette', reason: 'provider_error' });
    await new Promise((r) => setTimeout(r, 20));
    expect(seen?.aborted).toBe(true);
  });
});
