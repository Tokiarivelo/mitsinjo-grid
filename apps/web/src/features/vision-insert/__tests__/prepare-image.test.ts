import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canvasReadable, prepareVisionImage, resetCanvasCheck } from '../utils/prepare-image';

const ORIGINAL = new Blob([new Uint8Array(500)], { type: 'image/jpeg' });
const RESIZED = new Blob([new Uint8Array(50)], { type: 'image/jpeg' });

/** Fake 2D context: `readBack` is what getImageData returns for the 2-pixel probe. */
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

const RED_BLUE = [255, 0, 0, 255, 0, 0, 255, 255];
/** What Firefox fingerprinting protection reads back: a blank (white) canvas. */
const BLANK = [255, 255, 255, 255, 255, 255, 255, 255];

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
    resetCanvasCheck();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ blob: async () => ORIGINAL }))
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('canvasReadable: true when pixels read back, false when blanked by privacy protection', () => {
    stubCanvas(RED_BLUE);
    expect(canvasReadable()).toBe(true);
    resetCanvasCheck();
    stubCanvas(BLANK);
    expect(canvasReadable()).toBe(false);
  });

  it('large photo + readable canvas → resized JPEG', async () => {
    stubCanvas(RED_BLUE);
    stubImage(4000, 3000);
    expect(await prepareVisionImage('data:image/jpeg;base64,AA')).toBe(RESIZED);
  });

  it('regression: blank canvas (Firefox protection) → original photo, never a blank image', async () => {
    const ctx = stubCanvas(BLANK);
    stubImage(4000, 3000);
    expect(await prepareVisionImage('data:image/jpeg;base64,AA')).toBe(ORIGINAL);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('photo already ≤ 1280 px → original bytes, no re-encoding', async () => {
    const ctx = stubCanvas(RED_BLUE);
    stubImage(1024, 768);
    expect(await prepareVisionImage('data:image/jpeg;base64,AA')).toBe(ORIGINAL);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});
