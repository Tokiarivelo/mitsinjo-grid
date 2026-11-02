import { describe, it, expect, vi, afterEach } from 'vitest';
import { exportPosterPng } from '../poster-export';

/** Image that "loads" instantly with a fixed size. */
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin: string | null = null;
  width = 1200;
  height = 800;
  complete = true;
  set src(_v: string) {
    queueMicrotask(() => this.onload?.());
  }
}

function stubCanvas2d() {
  const ctx = {
    fillStyle: '',
    font: '',
    textBaseline: '',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    fillText: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AA');
  return ctx;
}

describe('exportPosterPng (M5-T3)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('draws the lines over the picture and downloads the PNG', async () => {
    vi.stubGlobal('Image', FakeImage);
    const ctx = stubCanvas2d();
    const click = vi.fn();
    const anchor = { click, style: {} } as unknown as HTMLAnchorElement;
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      tag === 'a' ? anchor : realCreateElement(tag)) as typeof document.createElement);

    const ok = await exportPosterPng(
      'https://img.example/poster.webp',
      ['Load shedding tonight', 'Local Market & Artisans · 18:00–22:00'],
      'poster-SIM-1.png'
    );

    expect(ok).toBe(true);
    expect(ctx.drawImage).toHaveBeenCalled();
    const drawn = ctx.fillText.mock.calls.map((c) => String(c[0])).join('\n');
    expect(drawn).toContain('18:00–22:00');
    expect(anchor.download).toBe('poster-SIM-1.png');
    expect(anchor.href).toMatch(/^data:image\/png/);
    expect(click).toHaveBeenCalled();
  });

  it('fails gracefully without a 2d context', async () => {
    vi.stubGlobal('Image', FakeImage);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const ok = await exportPosterPng('https://img.example/poster.webp', ['title'], 'p.png');
    expect(ok).toBe(false);
  });
});
