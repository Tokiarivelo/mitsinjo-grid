import { describe, expect, it } from 'vitest';
import { ObjectRecipeSchema, fitRecipe } from '@/lib/object-shape';
import {
  DEFAULT_DEPTH_RATIO,
  DOOR_COLOR,
  depthRatio,
  facadeHouseRecipe,
  fuseDepth,
  measureElevation,
  ridgeShare,
  roofKind,
  sideConsistent,
  sideRoofHint,
  type Elevation,
  type ElevationMasks,
} from '../facade-house';
import { renderFlat } from '../flat-render';

/** Rectangle ring (image fractions). */
const rect = (x0: number, y0: number, x1: number, y1: number) => [
  [x0, y0] as const,
  [x1, y0] as const,
  [x1, y1] as const,
  [x0, y1] as const,
];

/**
 * The user's rural house (2026-11-02), SAM boxes measured live on the 1920 × 1280 front elevation:
 * hipped roof (trapezoid), 2 chimneys, 7 windows, 1 door. Before: the photo roofline read the two
 * chimneys as gables (crenellated roof) and the photo box made a narrow tower.
 */
const RURAL_FRONT: ElevationMasks = {
  aspect: 1920 / 1280,
  house: { x: 0.162, y: 0.038, w: 0.676, h: 0.695 },
  roof: {
    box: { x: 0.162, y: 0.087, w: 0.676, h: 0.202 },
    // Trapezoid: slopes from the eaves to a ridge from x 0.29 to 0.71.
    rings: [
      [
        [0.162, 0.289],
        [0.29, 0.087],
        [0.71, 0.087],
        [0.838, 0.289],
      ],
    ],
  },
  wall: { x: 0.178, y: 0.302, w: 0.645, h: 0.409 },
  windows: [
    { x: 0.327, y: 0.523, w: 0.099, h: 0.139 },
    { x: 0.692, y: 0.523, w: 0.099, h: 0.139 },
    { x: 0.209, y: 0.523, w: 0.099, h: 0.139 },
    { x: 0.257, y: 0.322, w: 0.1, h: 0.139 },
    { x: 0.641, y: 0.322, w: 0.099, h: 0.138 },
    { x: 0.574, y: 0.523, w: 0.099, h: 0.139 },
    { x: 0.45, y: 0.323, w: 0.1, h: 0.138 },
  ],
  doors: [{ x: 0.476, y: 0.561, w: 0.049, h: 0.143 }],
  chimneys: [
    { x: 0.297, y: 0.037, w: 0.032, h: 0.072 },
    { x: 0.671, y: 0.037, w: 0.032, h: 0.072 },
  ],
};

/** Its side elevation drawn by Muse Image (live): triangle roof end, 2 windows, one chimney. */
const RURAL_SIDE: ElevationMasks = {
  aspect: 1920 / 1280,
  house: { x: 0.234, y: 0.048, w: 0.507, h: 0.873 },
  roof: {
    box: { x: 0.234, y: 0.088, w: 0.507, h: 0.275 },
    rings: [
      [
        [0.234, 0.363],
        [0.4875, 0.088],
        [0.741, 0.363],
      ],
    ],
  },
  wall: { x: 0.254, y: 0.36, w: 0.468, h: 0.529 },
  windows: [
    { x: 0.42, y: 0.642, w: 0.134, h: 0.186 },
    { x: 0.42, y: 0.384, w: 0.134, h: 0.184 },
  ],
  doors: [],
  chimneys: [{ x: 0.5, y: 0.04, w: 0.03, h: 0.07 }],
};

const COLORS = { main: '#d9c5b1', secondary: '#5a5e64', accent: '#2b2524' };

const front = () => measureElevation(RURAL_FRONT)!;
const side = () => measureElevation(RURAL_SIDE)!;

describe('ridgeShare', () => {
  it('reads the flat top of a trapezoid roof, chimney columns left out', () => {
    const r = ridgeShare(RURAL_FRONT.roof!.rings!, RURAL_FRONT.roof!.box, RURAL_FRONT.chimneys);
    expect(r).toBeGreaterThan(0.5);
    expect(r).toBeLessThan(0.75);
  });

  it('a triangle is a peak, a rectangle all ridge', () => {
    const tri = [
      [
        [0, 1],
        [0.5, 0],
        [1, 1],
      ] as const,
    ];
    expect(ridgeShare(tri, { x: 0, y: 0, w: 1, h: 1 })).toBeLessThan(0.15);
    expect(ridgeShare([rect(0, 0, 1, 1)], { x: 0, y: 0, w: 1, h: 1 })).toBe(1);
  });
});

describe('measureElevation', () => {
  it('body = roof + walls, chimneys above it, eave at the roof foot', () => {
    const e = front();
    expect(e.top).toBeCloseTo(0.087, 6);
    expect(e.eave).toBeCloseTo(0.289, 6);
    expect(e.bottom).toBeCloseTo(0.733, 6);
    expect(e.wallLeft).toBeCloseTo(0.178, 6);
    expect(e.left).toBeCloseTo(0.162, 6);
    expect(e.windows).toHaveLength(7);
    expect(e.doors).toHaveLength(1);
    expect(e.chimneys).toHaveLength(2);
  });

  it('null without anything to stand on', () => {
    expect(measureElevation({ aspect: 1.5, windows: [], doors: [], chimneys: [] })).toBeNull();
  });

  it('a thin roof band is a flat top (shop, block)', () => {
    const e = measureElevation({
      aspect: 1,
      roof: { box: { x: 0.1, y: 0.1, w: 0.8, h: 0.02 } },
      wall: { x: 0.1, y: 0.12, w: 0.8, h: 0.78 },
      windows: [],
      doors: [],
      chimneys: [],
    })!;
    expect(e.eave).toBe(e.top);
    expect(roofKind(e, null).kind).toBe('flat');
  });
});

describe('roof kind and side checks', () => {
  it('trapezoid front → hipped roof with the measured ridge', () => {
    const k = roofKind(front(), side());
    expect(k.kind).toBe('hip');
    expect(k.ridge).toBeGreaterThan(0.5);
  });

  it('peaked front → gable on the street; peaked on both sides → pyramid', () => {
    const peak: Elevation = { ...front(), ridge: 0.05 };
    expect(roofKind(peak, null)).toEqual({ kind: 'gable', ridge: 0 });
    expect(roofKind(peak, { ...side(), ridge: 1 }).kind).toBe('gable');
    expect(roofKind(peak, { ...side(), ridge: 0.05 })).toEqual({ kind: 'hip', ridge: 0 });
  });

  it('the side prompt asks for the roof end or its long slope', () => {
    expect(sideRoofHint(front())).toBe('end');
    expect(sideRoofHint({ ...front(), ridge: 0.05 })).toBe('slope');
  });

  it('a side drawn as a copy of a peaked front is rejected (live: the cottage)', () => {
    const peak: Elevation = { ...front(), ridge: 0.05 };
    expect(sideConsistent(peak, { ...peak })).toBe(false);
    expect(sideConsistent(front(), side())).toBe(true);
    // Storeys drawn at another height.
    expect(sideConsistent(front(), { ...side(), eave: side().top + 0.05 })).toBe(false);
  });
});

describe('depth', () => {
  it('side wall over front wall at the same body height', () => {
    expect(depthRatio(front(), side())).toBeCloseTo(0.57, 1);
    expect(depthRatio(front(), null)).toBeNull();
  });

  it('fuses with Spark: mean when they agree, Spark when the drawing is off', () => {
    expect(fuseDepth(0.62, 0.7)).toBeCloseTo(Math.sqrt(0.62 * 0.7), 6);
    // Live cottage: the side sheet drawn as wide as the front.
    expect(fuseDepth(0.97, 0.65)).toBe(0.65);
    expect(fuseDepth(null, 0.65)).toBe(0.65);
    expect(fuseDepth(0.5, undefined)).toBe(0.5);
    expect(fuseDepth(null, undefined)).toBe(DEFAULT_DEPTH_RATIO);
  });
});

describe('facadeHouseRecipe', () => {
  const recipe = () =>
    facadeHouseRecipe({
      front: front(),
      side: side(),
      colors: COLORS,
      materials: { main: 'plaster', secondary: 'slate', accent: 'glass' },
      sparkDepth: 0.7,
    });

  it('is a valid recipe within the part budget, priorities kept', () => {
    const r = recipe();
    expect(ObjectRecipeSchema.safeParse(fitRecipe(r, 0)).success).toBe(true);
    expect(r.parts).toHaveLength(12);
    expect(r.parts[0]!.front).toBe(true);
    expect(r.parts[1]!.shape).toBe('hip');
    expect(r.parts.filter((p) => p.material === 'glass')).toHaveLength(7);
    expect(r.parts.filter((p) => p.material === 'brick')).toHaveLength(2);
  });

  it('keeps the facade proportions (before: a narrow tower from the photo box)', () => {
    const { w, h, d } = recipe().proportions;
    expect(w).toBe(1);
    // 9.6 m wide, 6.3 m to the ridge + chimneys.
    expect(w / h).toBeGreaterThan(1.3);
    expect(w / h).toBeLessThan(1.6);
    expect(d / w).toBeGreaterThan(0.5);
    expect(d / w).toBeLessThan(0.8);
  });

  it('the door is wood, never the roof (before: the door took the roof role)', () => {
    const door = recipe().parts.find((p) => p.material === 'wood')!;
    expect(door.color).toBe(DOOR_COLOR);
    expect(door.at[2]).toBeGreaterThan(0);
  });

  it('chimneys rise above the roof, walls stop at the eave', () => {
    const r = recipe();
    const roofTop = r.parts[1]!.at[1] + r.parts[1]!.size[1] / 2;
    for (const c of r.parts.filter((p) => p.material === 'brick'))
      expect(c.at[1] + c.size[1] / 2).toBeGreaterThan(roofTop);
    const walls = r.parts[0]!;
    expect(walls.at[1] + walls.size[1] / 2).toBeCloseTo(
      r.parts[1]!.at[1] - r.parts[1]!.size[1] / 2,
      6
    );
  });

  it('front view renders the trapezoid: wide at the eave, narrow at the ridge', () => {
    const fitted = fitRecipe(recipe(), 0);
    const n = 96;
    const flat = renderFlat(fitted, 1, n, n, { yaw: 0, pitch: 0 });
    const width = (row: number) => {
      let c = 0;
      for (let x = 0; x < n; x++) c += flat.mask.data[row * n + x]!;
      return c;
    };
    let first = 0;
    while (first < n && width(first) === 0) first++;
    const rows = Array.from({ length: n }, (_, y) => width(y));
    const widest = Math.max(...rows);
    // Below the chimneys, the roof's top rows are clearly narrower than the walls.
    expect(rows[Math.round(n * 0.25)]!).toBeLessThan(widest);
    expect(widest).toBeGreaterThan(0.8 * n);
  });

  it('side windows go to the right wall when the budget allows', () => {
    const r = facadeHouseRecipe({
      front: { ...front(), windows: front().windows.slice(0, 2) },
      side: side(),
      colors: COLORS,
    });
    const onRight = r.parts.filter((p) => p.status === 'inferred');
    expect(onRight).toHaveLength(2);
    for (const p of onRight) expect(p.at[0]).toBeGreaterThan(0);
  });

  it('without a side: Spark depth, chimneys on the ridge line', () => {
    const r = facadeHouseRecipe({ front: front(), side: null, colors: COLORS, sparkDepth: 0.5 });
    for (const c of r.parts.filter((p) => p.material === 'brick')) expect(c.at[2]).toBe(0);
    expect(r.proportions.d / r.proportions.w).toBeGreaterThan(0.45);
    expect(r.proportions.d / r.proportions.w).toBeLessThan(0.6);
  });
});
