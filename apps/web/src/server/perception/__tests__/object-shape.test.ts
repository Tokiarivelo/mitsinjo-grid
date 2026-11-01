// @vitest-environment node
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import type { ObjectRecipe, ShapeTarget } from '@/lib/object-shape';
vi.mock('server-only', () => ({}));
import { runObjectShape, SHAPE_TIMEOUT_MS } from '../object-shape';
import type { ShapeResult } from '../schemas';
import { kitToRecipe, type ObjectKit } from '@/lib/object-kit';

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
    const out = await runObjectShape(p, null, 'data:full', target, { timeoutMs: 5 });
    expect(out).toMatchObject({ mode: 'silhouette', reason: 'provider_error' });
    await new Promise((r) => setTimeout(r, 20));
    expect(seen?.aborted).toBe(true);
  });

  it('gives Spark 60 s (it needs 15–40 s) and reports each step', async () => {
    expect(SHAPE_TIMEOUT_MS).toBe(60_000);
    const steps: string[] = [];
    await runObjectShape(client(meta(tall)), await photo(), 'data:full', target, {
      onStep: (s) => steps.push(s),
    });
    expect(steps).toEqual(['crop', 'model', 'fit']);
  });

  it('a Meta timeout is reason « timeout », other Meta errors keep their cause', async () => {
    const timedOut = client({
      recipe: tall,
      source: 'mock',
      model: 'mock-perception-v1',
      fallback: 'provider_error',
      failure: 'timeout',
    });
    expect(await runObjectShape(timedOut, null, 'data:full', target)).toMatchObject({
      mode: 'silhouette',
      reason: 'timeout',
      detail: 'timeout',
    });
    const refused = client({
      recipe: tall,
      source: 'mock',
      model: 'mock-perception-v1',
      fallback: 'provider_error',
      failure: 'http_429',
    });
    expect(await runObjectShape(refused, null, 'data:full', target)).toMatchObject({
      reason: 'provider_error',
      detail: 'http_429',
    });
  });
});

/** Street photo 200×100: sky (rows 0–29), roof (30–54), stone walls with dark windows (55–99). */
async function street() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
    <rect width="200" height="30" fill="#96beef"/>
    <rect y="30" width="200" height="25" fill="#6e5f55"/>
    <rect y="55" width="200" height="45" fill="#c8aa78"/>
    ${[20, 60, 100, 140].map((x) => `<rect x="${x}" y="65" width="16" height="14" fill="#1e232d"/>`).join('')}
  </svg>`;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return { buffer, width: 200, height: 100 };
}
const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const near = (a: string, b: string, tol = 12) =>
  hexRgb(a).every((v, i) => Math.abs(v - hexRgb(b)[i]!) <= tol);

describe('runObjectShape measured colours (PF-T2)', () => {
  const cottage: ShapeTarget = {
    id: 'det-4',
    label: 'stone cottages row',
    category: 'other',
    scenery: 'building',
    box: { x: 0, y: 0, w: 1, h: 1 },
    // SAM outline: the cottages only, the sky above is outside.
    outline: 'M0 0.3L1 0.3L1 1L0 1Z',
  };
  const guessed: ObjectKit = {
    archetype: 'house',
    proportions: { w: 1, h: 0.5, d: 0.4 },
    colors: { main: '#202020', secondary: '#000000', accent: '#ff8800' },
    details: { windows: 4 },
  };

  it('replaces Spark colours with the photo ones, sky cut by the outline (regression: black roof)', async () => {
    const p = client(meta(kitToRecipe(guessed), { kit: guessed }));
    const out = await runObjectShape(p, await street(), 'data:full', cottage);
    expect(out.mode).toBe('recipe');
    const colors = new Set(out.recipe!.parts.map((x) => x.color));
    const walls = out.recipe!.parts.find((x) => x.front)!.color;
    expect(near(walls, '#c8aa78')).toBe(true);
    // Roof slabs = measured roof colour; no part keeps the guessed black / orange, none is sky blue.
    expect([...colors].some((c) => near(c, '#6e5f55'))).toBe(true);
    expect([...colors].some((c) => c === '#000000' || c === '#ff8800')).toBe(false);
    expect([...colors].some((c) => near(c, '#96beef', 20))).toBe(false);
    expect(out).not.toHaveProperty('kit');
  });

  it('no photo (crop impossible) → Spark colours kept', async () => {
    const p = client(meta(kitToRecipe(guessed), { kit: guessed }));
    const out = await runObjectShape(p, null, 'data:full', cottage);
    expect(out.recipe!.parts.some((x) => x.color === '#000000')).toBe(true);
  });
});

describe('runObjectShape measured roof (PF-T3)', () => {
  const kitOf = (archetype: ObjectKit['archetype']): ObjectKit => ({
    archetype,
    proportions: { w: 1, h: 0.5, d: 0.4 },
    colors: { main: '#202020', secondary: '#000000', accent: '#ff8800' },
  });
  /** Row of 3 gabled cottages: walls to y 0.55, ridges at y 0.3 (photo fractions, whole box). */
  const row = (outline?: string): ShapeTarget => ({
    id: 'det-4',
    label: 'stone cottages row',
    category: 'other',
    scenery: 'building',
    box: { x: 0, y: 0, w: 1, h: 1 },
    ...(outline ? { outline } : {}),
  });
  const gabled = 'M0 1L0 0.55L0.1667 0.3L0.3333 0.55L0.5 0.3L0.6667 0.55L0.8333 0.3L1 0.55L1 1Z';

  it('gabled outline → one prism per gable; a pitched « building » becomes a house', async () => {
    const p = client(meta(kitToRecipe(kitOf('building')), { kit: kitOf('building') }));
    const out = await runObjectShape(p, await street(), 'data:full', row(gabled));
    expect(out.mode).toBe('recipe');
    expect(out.recipe!.parts.filter((x) => x.shape === 'prism')).toHaveLength(3);
  });

  it('flat outline, no outline, or not a building → no prism (template unchanged)', async () => {
    for (const [kit, t] of [
      [kitOf('house'), row('M0 0.3L1 0.3L1 1L0 1Z')],
      [kitOf('house'), row()],
      [kitOf('cabinet'), row(gabled)],
    ] as const) {
      const out = await runObjectShape(
        client(meta(kitToRecipe(kit), { kit })),
        await street(),
        'data:full',
        t
      );
      expect(out.recipe!.parts.some((x) => x.shape === 'prism')).toBe(false);
    }
  });
});
