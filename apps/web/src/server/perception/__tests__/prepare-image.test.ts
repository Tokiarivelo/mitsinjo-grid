// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

vi.mock('server-only', () => ({}));

import { prepareVisionImage, VISION_MAX_SIDE } from '../prepare-image';

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 30, g: 120, b: 200 } } });

describe('prepareVisionImage (server, PV)', () => {
  it('applies the EXIF orientation: a sideways phone photo comes out upright', async () => {
    // Stored 40×20 with orientation 6 (rotate 90°): displayed 20×40 by every browser.
    const sideways = await solid(40, 20).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const out = await prepareVisionImage(sideways, 'image/jpeg');
    const meta = await sharp(out.buffer).metadata();
    expect(out.normalized).toBe(true);
    expect([meta.width, meta.height]).toEqual([20, 40]);
    expect(meta.orientation ?? 1).toBe(1);
  });

  it('fits the longest side to 1280 px as JPEG, never upscales', async () => {
    const big = await solid(4000, 3000).png().toBuffer();
    const out = await prepareVisionImage(big, 'image/png');
    const meta = await sharp(out.buffer).metadata();
    expect(out.contentType).toBe('image/jpeg');
    expect([meta.width, meta.height]).toEqual([VISION_MAX_SIDE, 960]);

    const small = await solid(640, 480).webp().toBuffer();
    const smallMeta = await sharp(
      (await prepareVisionImage(small, 'image/webp')).buffer
    ).metadata();
    expect([smallMeta.width, smallMeta.height]).toEqual([640, 480]);
  });

  it('undecodable bytes are passed on unchanged', async () => {
    const junk = Buffer.from('not an image');
    expect(await prepareVisionImage(junk, 'image/jpeg')).toEqual({
      buffer: junk,
      contentType: 'image/jpeg',
      normalized: false,
    });
  });
});
