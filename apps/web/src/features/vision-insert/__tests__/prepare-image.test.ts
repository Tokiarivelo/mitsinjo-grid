import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { looksBlank, prepareVisionImage } from '../utils/prepare-image';

const ORIGINAL = new Blob([new Uint8Array(500)], { type: 'image/jpeg' });
const RESIZED = new Blob([new Uint8Array(50)], { type: 'image/jpeg' });

/** Fake 2D context: `readBack` is what getImageData returns for the drawn photo. */
function stubCanvas(readBack: number[]) {
  const ctx = {
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: Uint8ClampedArray.from(readBack) })),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb) {
    cb(RESIZED);
  });
  return ctx;
}

/** A real photo: varied pixels. */
const PHOTO = Array.from({ length: 400 }, (_, i) => (i * 37) % 256);
/** What Firefox fingerprinting protection reads back: one flat colour. */
const BLANK = Array.from({ length: 400 }, (_, i) => (i % 4 === 3 ? 255 : 254));

function stubImage(width: number, height: number) {
  vi.stubGlobal(
    'Image',
    class {
      src = '';
      naturalWidth = width;
      naturalHeight = height;
      decode = async () => {};
    }
  );
}

describe('prepareVisionImage (PV)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ blob: async () => ORIGINAL }))
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('looksBlank: flat colour → true, a photo → false', () => {
    expect(looksBlank(BLANK)).toBe(true);
    expect(looksBlank(PHOTO)).toBe(false);
    expect(looksBlank([])).toBe(true);
  });

  it('large photo + readable canvas → resized JPEG', async () => {
    stubCanvas(PHOTO);
    stubImage(4000, 3000);
    expect(await prepareVisionImage('data:image/jpeg;base64,AA')).toBe(RESIZED);
  });

  it('regression: blank canvas (Firefox protection) → original photo, never a blank image', async () => {
    stubCanvas(BLANK);
    stubImage(4000, 3000);
    expect(await prepareVisionImage('data:image/jpeg;base64,AA')).toBe(ORIGINAL);
  });

  it('photo already ≤ 1280 px → original bytes, no re-encoding', async () => {
    const ctx = stubCanvas(PHOTO);
    stubImage(1024, 768);
    expect(await prepareVisionImage('data:image/jpeg;base64,AA')).toBe(ORIGINAL);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});
