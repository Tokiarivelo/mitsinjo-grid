import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareVisionImage, VISION_UPLOAD_MAX_BYTES } from '../utils/prepare-image';

describe('prepareVisionImage (client, PV)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('regression: sends the photo bytes as picked, never through a canvas (blank on Firefox)', async () => {
    const original = new Blob([new Uint8Array(500)], { type: 'image/jpeg' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ blob: async () => original }))
    );
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    expect(await prepareVisionImage('data:image/jpeg;base64,AA')).toBe(original);
    expect(getContext).not.toHaveBeenCalled();
  });

  function stubPhoto(size: number) {
    const original = new Blob([new Uint8Array(size)], { type: 'image/jpeg' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ blob: async () => original }))
    );
    return original;
  }

  function stubCanvas(outSize: number) {
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 4000, height: 3000, close }))
    );
    const ctx = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb) {
      cb(new Blob([new Uint8Array(outSize)], { type: 'image/jpeg' }));
    });
    return ctx;
  }

  it('regression: a 4.8 MB phone photo is shrunk under the host body limit (FUNCTION_PAYLOAD_TOO_LARGE)', async () => {
    stubPhoto(4.8 * 1024 * 1024);
    const ctx = stubCanvas(900_000);
    const out = await prepareVisionImage('data:image/jpeg;base64,AA');
    expect(out.size).toBe(900_000);
    expect(out.size).toBeLessThanOrEqual(VISION_UPLOAD_MAX_BYTES);
    // 4000×3000 → longest side 2560.
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2560, 1920);
    expect(createImageBitmap).toHaveBeenCalledWith(expect.anything(), {
      imageOrientation: 'from-image',
    });
  });

  it('sends the original when the browser cannot shrink it', async () => {
    const original = stubPhoto(4.8 * 1024 * 1024);
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('decode failed');
      })
    );
    expect(await prepareVisionImage('data:image/jpeg;base64,AA')).toBe(original);
  });
});
