import { describe, expect, it } from 'vitest';
import {
  ZOOM_IDENTITY,
  ZOOM_MAX,
  ZOOM_MIN,
  clampPan,
  panBy,
  toTransform,
  zoomAround,
} from '../zoom-pan';

const W = 800;
const H = 500;

describe('zoom-pan', () => {
  it('keeps the point under the cursor fixed while zooming', () => {
    const origin: [number, number] = [200, 100];
    const z = zoomAround(ZOOM_IDENTITY, 2, origin, W, H);
    expect(z.scale).toBe(2);
    // content point under the cursor before: (200, 100); after: same screen spot
    expect(200 * z.scale + z.x).toBeCloseTo(origin[0]);
    expect(100 * z.scale + z.y).toBeCloseTo(origin[1]);
  });

  it('clamps scale between ZOOM_MIN and ZOOM_MAX', () => {
    expect(zoomAround(ZOOM_IDENTITY, 0.2, [0, 0], W, H).scale).toBe(ZOOM_MIN);
    expect(zoomAround({ scale: 3, x: 0, y: 0 }, 10, [0, 0], W, H).scale).toBe(ZOOM_MAX);
  });

  it('never pans the content away from the viewport edges', () => {
    const z = panBy({ scale: 2, x: 0, y: 0 }, 5000, -5000, W, H);
    expect(z.x).toBe(0); // can't drag past the left edge
    expect(z.y).toBe(H - H * 2); // bottom edge stops at the viewport bottom
    expect(clampPan({ scale: 1, x: -40, y: 30 }, W, H)).toEqual(ZOOM_IDENTITY);
  });

  it('zooming back out to 1 recenters the content', () => {
    const zoomed = zoomAround(ZOOM_IDENTITY, 3, [700, 400], W, H);
    expect(zoomAround(zoomed, 1 / 3, [10, 10], W, H)).toEqual(ZOOM_IDENTITY);
  });

  it('formats a CSS transform', () => {
    expect(toTransform({ scale: 2, x: -10, y: -5 })).toBe('translate(-10px, -5px) scale(2)');
  });
});
