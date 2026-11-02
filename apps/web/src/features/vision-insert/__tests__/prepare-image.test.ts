import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareVisionImage } from '../utils/prepare-image';

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
});
