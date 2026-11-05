// @vitest-environment node
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/env', () => ({
  env: { LLM_PROVIDER: 'meta', META_API_KEY: 'test-key', META_IMAGE_MODEL: 'muse-image-test' },
}));
vi.mock('@/server/storage/r2', () => ({
  isR2Configured: () => false,
  uploadBufferToR2: async () => 'local',
}));

import type { ShapeTarget } from '@/lib/object-shape';
import { FACADE_FROM_PHOTO, buildFacadePrompt, generateFacadeImage } from '../facade-specialist';

const target: ShapeTarget = {
  id: 'det-2',
  label: 'lamp post',
  category: 'lamp',
  box: { x: 0.45, y: 0.2, w: 0.1, h: 0.6 },
};

async function photo() {
  const buffer = await sharp({
    create: { width: 200, height: 100, channels: 3, background: '#887356' },
  })
    .jpeg()
    .toBuffer();
  return { buffer, width: 200, height: 100 };
}

const png = async () =>
  (
    await sharp({ create: { width: 4, height: 4, channels: 3, background: '#ffffff' } })
      .png()
      .toBuffer()
  ).toString('base64');

type Body = { input: string | Array<{ content: Array<{ type: string; text?: string }> }> };

afterEach(() => vi.unstubAllGlobals());

describe('2D view drawn from the photo (user 2026-11-05)', () => {
  it('asks for the object of the reference photo', () => {
    expect(buildFacadePrompt('lamp_post', 'lamp post', undefined, { fromPhoto: true })).toContain(
      FACADE_FROM_PHOTO
    );
    expect(buildFacadePrompt('lamp_post', 'lamp post')).not.toContain(FACADE_FROM_PHOTO);
  });

  it('sends the photo crop beside the prompt (before: label only, a generic object was drawn)', async () => {
    const bodies: Body[] = [];
    const result = await png();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)) as Body);
        return new Response(
          JSON.stringify({ output: [{ type: 'image_generation_call', result }] })
        );
      })
    );
    const res = await generateFacadeImage({ target, photo: await photo() });
    expect(res.source).toBe('meta');
    expect(res.prompt).toContain(FACADE_FROM_PHOTO);
    const input = bodies[0]!.input;
    expect(Array.isArray(input)).toBe(true);
    const types = (input as Exclude<Body['input'], string>)[0]!.content.map((c) => c.type);
    expect(types).toEqual(['input_text', 'input_image']);
  });

  it('a refused reference retries from the label alone, still a Meta drawing', async () => {
    const bodies: Body[] = [];
    const result = await png();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)) as Body);
        return bodies.length === 1
          ? new Response('bad image', { status: 400 })
          : new Response(JSON.stringify({ output: [{ type: 'image_generation_call', result }] }));
      })
    );
    const res = await generateFacadeImage({ target, photo: await photo() });
    expect(bodies).toHaveLength(2);
    expect(typeof bodies[1]!.input).toBe('string');
    expect(res.source).toBe('meta');
    expect(res.prompt).not.toContain(FACADE_FROM_PHOTO);
  });
});
