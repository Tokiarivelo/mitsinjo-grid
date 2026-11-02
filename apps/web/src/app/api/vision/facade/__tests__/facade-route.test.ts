// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

import { POST, DELETE } from '../route';

// A tiny valid 1x1 JPEG buffer for image uploads in tests
const TINY_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x00, 0xff, 0xd9,
]);

const buildPostRequest = (form: FormData) =>
  new Request('http://localhost/api/vision/facade', {
    method: 'POST',
    body: form,
  }) as unknown as NextRequest;

const buildDeleteRequest = (url: string, body?: unknown) =>
  new Request(url, {
    method: 'DELETE',
    ...(body
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  }) as unknown as NextRequest;

const houseTarget = {
  id: 'house-1',
  label: 'rural cottage',
  category: 'other',
  scenery: 'building',
  box: { x: 0.1, y: 0.1, w: 0.4, h: 0.5 },
};

describe('/api/vision/facade route', () => {
  it('POST generates an orthographic 2D facade image with prompt and returns consultable data', async () => {
    const form = new FormData();
    form.append('image', new Blob([TINY_JPEG], { type: 'image/jpeg' }), 'photo.jpg');
    form.append('target', JSON.stringify(houseTarget));
    form.append('userPrompt', 'red tin roof');

    const res = await POST(buildPostRequest(form));
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      ok: boolean;
      fileKey: string;
      imageUrl: string;
      prompt: string;
      archetype: string;
      detectionId: string;
    };

    expect(data.ok).toBe(true);
    expect(data.detectionId).toBe('house-1');
    expect(data.fileKey).toContain('vision/facades/house-1_');
    expect(data.imageUrl).toBeDefined();
    expect(data.prompt).toContain('red tin roof');
    expect(data.archetype).toBe('house');
  });

  it('DELETE removes a facade by query parameter', async () => {
    const res = await DELETE(
      buildDeleteRequest('http://localhost/api/vision/facade?key=vision%2Ffacades%2Fsample.png')
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; deleted: string };
    expect(data.ok).toBe(true);
    expect(data.deleted).toBe('vision/facades/sample.png');
  });

  it('DELETE returns 400 when key is missing', async () => {
    const res = await DELETE(buildDeleteRequest('http://localhost/api/vision/facade'));
    expect(res.status).toBe(400);
  });
});
