// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const museImage = vi.fn();
vi.mock('../facade-specialist', () => ({
  museImage: (...a: unknown[]) => museImage(...a),
  museImageReady: () => true,
}));

import {
  ELEVATION_ARCHETYPES,
  SIDE_ROOF_HINTS,
  SIDE_VIEW_ATTEMPTS,
  measureElevationImage,
  measureFacadeElevations,
  sideViewPrompt,
} from '../facade-views';

const W = 1000;
const H = 1000;
type Box = [number, number, number, number]; // x0 y0 x1 y1, fractions
const inst = ([x0, y0, x1, y1]: Box, outline?: string) => ({
  box: { x1: x0 * W, y1: y0 * H, x2: x1 * W - 1, y2: y1 * H - 1 },
  confidence: 0.9,
  ...(outline ? { outline } : {}),
});
const answer = (boxes: Array<ReturnType<typeof inst>>) => ({
  concept: 'x',
  boxCoverage: 0.1,
  count: boxes.length,
  instances: boxes,
  imageWidth: W,
  imageHeight: H,
  source: 'meta' as const,
  model: 'sam-3.1',
});

/** A front with a hipped roof (trapezoid outline) or a peaked one (triangle). */
const frontConcepts = (roof: 'hip' | 'peak'): Record<string, Array<ReturnType<typeof inst>>> => ({
  house: [inst([0.1, 0.1, 0.9, 0.9])],
  roof: [
    inst(
      [0.1, 0.1, 0.9, 0.4],
      roof === 'hip' ? 'M0.1 0.4L0.3 0.1L0.7 0.1L0.9 0.4Z' : 'M0.1 0.4L0.5 0.1L0.9 0.4Z'
    ),
  ],
  wall: [inst([0.12, 0.4, 0.88, 0.9])],
  window: [inst([0.2, 0.5, 0.3, 0.6]), inst([0.7, 0.5, 0.8, 0.6])],
  door: [inst([0.45, 0.6, 0.55, 0.9])],
  chimney: [],
});
/** A side drawn narrower, same heights. */
const sideConcepts = (roof: 'end' | 'copy'): Record<string, Array<ReturnType<typeof inst>>> =>
  roof === 'copy'
    ? frontConcepts('peak')
    : {
        house: [inst([0.3, 0.1, 0.7, 0.9])],
        roof: [inst([0.3, 0.1, 0.7, 0.4], 'M0.3 0.4L0.5 0.1L0.7 0.4Z')],
        wall: [inst([0.32, 0.4, 0.68, 0.9])],
        window: [inst([0.45, 0.5, 0.55, 0.6])],
        chimney: [],
      };

const SIDE_URL = 'data:image/png;base64,';
function segmenter(
  front: ReturnType<typeof frontConcepts>,
  sides: Array<ReturnType<typeof sideConcepts>>
) {
  let sideCall = -1;
  let lastSideUrl = '';
  return vi.fn(async (url: string, concept: string) => {
    if (!url.startsWith(SIDE_URL)) return answer(front[concept] ?? []);
    if (url !== lastSideUrl) {
      lastSideUrl = url;
      sideCall++;
    }
    return answer(sides[Math.min(sideCall, sides.length - 1)]![concept] ?? []);
  });
}

beforeEach(() => {
  museImage.mockReset();
  let n = 0;
  // A distinct PNG per call so each drawing is told apart by its URL.
  museImage.mockImplementation(async () => Buffer.from(`side-${n++}`));
});

describe('measureElevationImage', () => {
  it('measures one elevation from its SAM boxes', async () => {
    const seg = segmenter(frontConcepts('hip'), []);
    const out = await measureElevationImage(seg, 'https://r2/front.png', 'house');
    expect(out?.elevation.windows).toHaveLength(2);
    expect(out?.elevation.doors).toHaveLength(1);
    expect(out?.elevation.ridge).toBeGreaterThan(0.3);
  });

  it('measures plinth, steps and panes, keeps the roof outline (PG-T3)', async () => {
    const seg = segmenter(
      {
        ...frontConcepts('hip'),
        plinth: [inst([0.12, 0.85, 0.88, 0.9]), inst([0.4, 0.2, 0.6, 0.25])],
        step: [inst([0.43, 0.88, 0.57, 0.9])],
        'window pane': [inst([0.2, 0.5, 0.25, 0.55]), inst([0.5, 0.1, 0.55, 0.15])],
        // A post on the wall, and a « beam » in the roof (not a wall beam: dropped).
        'timber beam': [inst([0.35, 0.4, 0.36, 0.9]), inst([0.3, 0.15, 0.6, 0.16])],
      },
      []
    );
    const e = (await measureElevationImage(seg, 'https://r2/front.png', 'house'))!.elevation;
    expect(e.plinth?.w).toBeCloseTo(0.76, 2);
    expect(e.steps).toHaveLength(1);
    // The pane in the roof is not inside a window: dropped.
    expect(e.panes).toHaveLength(1);
    expect(e.roofRings?.[0]).toHaveLength(4);
    expect(e.beams).toHaveLength(1);
  });

  it('a SAM miss on the details keeps the elevation (no plinth, no panes)', async () => {
    const e = (await measureElevationImage(
      segmenter(frontConcepts('hip'), []),
      'https://r2/f.png',
      'house'
    ))!.elevation;
    expect(e.plinth).toBeNull();
    expect(e.panes).toEqual([]);
  });

  it('null when SAM answers only the mock', async () => {
    const seg = vi.fn(async () => ({ ...answer([]), source: 'mock' as const }));
    expect(await measureElevationImage(seg, 'https://r2/front.png', 'house')).toBeNull();
  });
});

describe('sideViewPrompt', () => {
  it('tells Muse Image what the roof shows from the side', async () => {
    const seg = segmenter(frontConcepts('peak'), []);
    const front = (await measureElevationImage(seg, 'https://r2/f.png', 'house'))!.elevation;
    expect(sideViewPrompt(front)).toContain(SIDE_ROOF_HINTS.slope);
    expect(sideViewPrompt(null)).not.toContain(SIDE_ROOF_HINTS.slope);
  });
});

describe('measureFacadeElevations', () => {
  it('front first, then the side drawn from it and kept when consistent', async () => {
    const seg = segmenter(frontConcepts('hip'), [sideConcepts('end')]);
    const onSideView = vi.fn();
    const out = await measureFacadeElevations(seg, 'https://r2/f.png', 'house', { onSideView });
    expect(out?.side?.windows).toHaveLength(1);
    expect(museImage).toHaveBeenCalledTimes(1);
    expect(museImage.mock.calls[0]![0]).toContain(SIDE_ROOF_HINTS.end);
    expect(museImage.mock.calls[0]![1]).toEqual(['https://r2/f.png']);
    expect(onSideView).toHaveBeenCalledTimes(1);
  });

  it('a side copied from the front is drawn again, then dropped (live: the cottage)', async () => {
    const seg = segmenter(frontConcepts('peak'), [sideConcepts('copy')]);
    const out = await measureFacadeElevations(seg, 'https://r2/f.png', 'house');
    expect(museImage).toHaveBeenCalledTimes(SIDE_VIEW_ATTEMPTS);
    expect(out?.front).toBeTruthy();
    expect(out?.side).toBeNull();
  });

  it('the second drawing is kept when it fixes the first', async () => {
    const seg = segmenter(frontConcepts('peak'), [
      sideConcepts('copy'),
      {
        ...sideConcepts('end'),
        roof: [inst([0.3, 0.1, 0.7, 0.4], 'M0.3 0.4L0.3 0.1L0.7 0.1L0.7 0.4Z')],
      },
    ]);
    const out = await measureFacadeElevations(seg, 'https://r2/f.png', 'house');
    expect(museImage).toHaveBeenCalledTimes(2);
    expect(out?.side).not.toBeNull();
  });

  it('Muse Image failing keeps the front alone', async () => {
    museImage.mockRejectedValue(new Error('http_500'));
    const seg = segmenter(frontConcepts('hip'), []);
    const out = await measureFacadeElevations(seg, 'https://r2/f.png', 'house');
    expect(out?.front).toBeTruthy();
    expect(out?.side).toBeNull();
  });

  it('other archetypes and unreadable fronts give null', async () => {
    expect(ELEVATION_ARCHETYPES).not.toContain('vehicle');
    const seg = segmenter(frontConcepts('hip'), []);
    expect(await measureFacadeElevations(seg, 'https://r2/f.png', 'vehicle')).toBeNull();
    const empty = vi.fn(async () => answer([]));
    expect(await measureFacadeElevations(empty, 'https://r2/f.png', 'house')).toBeNull();
    expect(museImage).not.toHaveBeenCalled();
  });
});
