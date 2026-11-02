import { describe, expect, it } from 'vitest';
import type { ObjectRecipe, RecipePart } from '@/lib/object-shape';
import { recipeMesh, triangleCount } from '../utils/object-geometry';
import {
  DEFAULT_WINDOW_GRID,
  DOOR_GLASS,
  FRAME_DARK,
  FRAME_LIGHT,
  expandOpenings,
  frameColor,
  luminance,
} from '../utils/openings';

const wall: RecipePart = {
  shape: 'box',
  at: [0, 0, 0],
  size: [1, 0.6, 0.6],
  color: '#e6dccb',
  material: 'plaster',
  kind: 'wall',
  front: true,
};
const win = (over: Partial<RecipePart> = {}): RecipePart => ({
  shape: 'box',
  at: [-0.25, 0.05, 0.3075],
  size: [0.14, 0.2, 0.015],
  color: '#2b3440',
  material: 'glass',
  kind: 'window',
  ...over,
});
const house = (...parts: RecipePart[]): ObjectRecipe => ({
  proportions: { w: 1, h: 0.6, d: 0.6 },
  parts: [wall, ...parts],
});

const bounds = (parts: RecipePart[], axis: number) => ({
  lo: Math.min(...parts.map((p) => p.at[axis]! - p.size[axis]! / 2)),
  hi: Math.max(...parts.map((p) => p.at[axis]! + p.size[axis]! / 2)),
});

describe('expandOpenings (PG-T8)', () => {
  it('leaves a recipe without openings untouched', () => {
    const r = house();
    expect(expandOpenings(r)).toBe(r.parts);
  });

  it('a window becomes glass + 4 frame pieces + default cross bars + sill', () => {
    const parts = expandOpenings(house(win()));
    const [cols, rows] = DEFAULT_WINDOW_GRID;
    // wall + glass + 4 frame + (cols-1)+(rows-1) bars + sill
    expect(parts).toHaveLength(1 + 1 + 4 + (cols - 1) + (rows - 1) + 1);
    const glass = parts.filter((p) => p.material === 'glass');
    expect(glass).toHaveLength(1);
    expect(parts.filter((p) => p.kind === 'frame').every((p) => p.material === 'wood')).toBe(true);
  });

  it('the frame stands proud of the glass, the glass is set back (relief = readable)', () => {
    const parts = expandOpenings(house(win()));
    const glass = parts.find((p) => p.material === 'glass')!;
    const frame = parts.filter((p) => p.kind === 'frame');
    const frontOf = (p: RecipePart) => p.at[2] + p.size[2] / 2;
    expect(Math.max(...frame.map(frontOf))).toBeGreaterThan(frontOf(glass));
    expect(glass.at[2]).toBeLessThan(win().at[2]);
  });

  it('keeps the opening outline (sill aside) and uses the measured pane grid', () => {
    const parts = expandOpenings(house(win({ grid: [2, 4] })));
    const frames = parts.filter((p) => p.kind === 'frame' || p.material === 'glass');
    const w = win();
    const x = bounds(
      frames.filter((p) => p.size[0] <= w.size[0] + 1e-9),
      0
    );
    expect(x.lo).toBeCloseTo(w.at[0] - w.size[0] / 2, 6);
    expect(x.hi).toBeCloseTo(w.at[0] + w.size[0] / 2, 6);
    // 1 vertical + 3 horizontal bars.
    expect(parts.length).toBe(1 + 1 + 4 + 1 + 3 + 1);
  });

  it('a door gets a frame and its leaf, no sill; two leaves for a grid [2, 1]', () => {
    const door = win({
      kind: 'door',
      material: 'wood',
      color: '#6b4a2f',
      size: [0.2, 0.35, 0.015],
      grid: [2, 1],
    });
    const parts = expandOpenings(house(door));
    expect(parts.filter((p) => p.kind === 'door')).toHaveLength(1);
    expect(parts.length).toBe(1 + 1 + 4 + 1);
  });

  it('side windows (thin along x) get their frame on the side wall, outward', () => {
    const side = win({ at: [0.5075, 0.05, 0], size: [0.015, 0.2, 0.2] });
    const parts = expandOpenings(house(side)).filter((p) => p.kind === 'frame');
    for (const p of parts) expect(p.at[0]).toBeGreaterThan(0.5);
  });

  it('frame colour stands out from the wall: dark on plaster, light on dark timber', () => {
    expect(frameColor('#e6dccb')).toBe(FRAME_DARK);
    expect(frameColor('#4a3a2c')).toBe(FRAME_LIGHT);
    expect(Math.abs(luminance(frameColor('#e6dccb')) - luminance('#e6dccb'))).toBeGreaterThan(0.4);
  });

  it('stays inside the triangle budget with 7 windows and 2 doors', () => {
    const many = house(
      ...Array.from({ length: 7 }, (_, i) => win({ at: [-0.4 + i * 0.13, 0.05, 0.3075] })),
      win({ kind: 'door', material: 'wood', at: [0, -0.1, 0.3075], grid: [2, 1] }),
      win({ kind: 'door', material: 'wood', at: [0.3, -0.1, 0.3075] })
    );
    const g = recipeMesh(many);
    expect(g.getAttribute('position').count / 3).toBeLessThanOrEqual(5_000);
  });
});

describe('opening assemblies (PG-T10)', () => {
  const door = (over: Partial<RecipePart> = {}) =>
    win({ kind: 'door', material: 'wood', color: '#6b4a2f', size: [0.2, 0.35, 0.015], ...over });

  it('a double door with a glazed top: glass over the top, leaf below, stile and transom', () => {
    const parts = expandOpenings(house(door({ leaves: 2, glazed: 0.4, grid: [2, 2] })));
    const glass = parts.filter((p) => p.material === 'glass');
    expect(glass).toHaveLength(1);
    expect(glass[0]!.color).toBe(DOOR_GLASS);
    const leaf = parts.find((p) => p.kind === 'door' && p.material === 'wood')!;
    // Glass above the leaf.
    expect(glass[0]!.at[1]).toBeGreaterThan(leaf.at[1]);
    expect(glass[0]!.size[1]).toBeLessThan(leaf.size[1]);
    // wall + glass + leaf + 4 frame + stile + transom + 1 pane row bar (centre column = stile).
    expect(parts).toHaveLength(1 + 2 + 4 + 1 + 1 + 1);
  });

  it('raised panels on each leaf, under the glass', () => {
    const parts = expandOpenings(house(door({ leaves: 2, glazed: 0.4, panels: 2 })));
    const leaf = parts.find((p) => p.kind === 'door' && p.material === 'wood' && p.size[0] > 0.1)!;
    const panels = parts.filter(
      (p) => p.kind === 'door' && p.material === 'wood' && p !== leaf && p.shape === 'box'
    );
    expect(panels).toHaveLength(4);
    for (const p of panels)
      expect(p.at[1] + p.size[1] / 2).toBeLessThanOrEqual(leaf.at[1] + leaf.size[1] / 2 + 1e-9);
  });

  it('a lintel above, a sill on a door only when asked, none on a window when sill is false', () => {
    const w = win();
    const withLintel = expandOpenings(house(win({ lintel: true })));
    const top = w.at[1] + w.size[1] / 2;
    expect(withLintel.some((p) => p.kind === 'frame' && p.at[1] > top)).toBe(true);
    const noSill = expandOpenings(house(win({ sill: false })));
    expect(noSill).toHaveLength(expandOpenings(house(win())).length - 1);
    const doorSill = expandOpenings(house(door({ sill: true })));
    expect(doorSill).toHaveLength(expandOpenings(house(door())).length + 1);
  });

  it('low detail drops bars, panels and lintels but keeps frame, glass and stile', () => {
    const d = door({ leaves: 2, glazed: 0.4, grid: [4, 2], panels: 2, lintel: true });
    const full = expandOpenings(house(d));
    const low = expandOpenings(house(d), 'low');
    expect(low.length).toBeLessThan(full.length);
    // wall + glass + leaf + 4 frame + stile + transom.
    expect(low).toHaveLength(1 + 2 + 4 + 1 + 1);
  });

  it('a heavily detailed house falls back to low detail within the triangle budget', () => {
    const rich = {
      leaves: 2,
      glazed: 0.5,
      grid: [6, 6] as [number, number],
      panels: 4,
      lintel: true,
    };
    const many = house(
      ...Array.from({ length: 30 }, (_, i) =>
        door({
          at: [-0.45 + (i % 10) * 0.1, -0.2 + Math.floor(i / 10) * 0.2, 0.3075],
          size: [0.08, 0.15, 0.015],
          ...rich,
        })
      )
    );
    expect(triangleCount(recipeMesh(many))).toBeLessThanOrEqual(5_000);
  });
});
