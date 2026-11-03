import { describe, expect, it } from 'vitest';
import type { RecipePart } from '@/lib/object-shape';
import {
  CELL_LINE_COLOR,
  RIM_COLOR,
  RIM_DIAMETER,
  expandViewAssemblies,
} from '../utils/view-assemblies';

const wheel: RecipePart = {
  shape: 'cylinder',
  axis: 'x',
  at: [0.4, -0.35, 0.3],
  size: [0.1, 0.3, 0.3],
  color: '#1d1d1f',
  material: 'rubber',
  kind: 'wheel',
  rim: true,
};
const cells: RecipePart = {
  shape: 'hull',
  at: [0, 0, 0],
  size: [1, 1, 1],
  points: [
    [-0.4, -0.2],
    [0.4, -0.2],
    [0.4, 0.3],
    [-0.4, 0.3],
  ],
  // Tilted face: z falls as y rises.
  section: [
    [0.1, -0.2],
    [0.11, -0.2],
    [0.01, 0.3],
    [0, 0.3],
  ],
  color: '#1f3550',
  material: 'glass',
  kind: 'cell',
  grid: [4, 2],
};

describe('view assemblies (PG-T21)', () => {
  it('puts a metal rim on the outer face of a wheel', () => {
    const [tyre, rim, ...rest] = expandViewAssemblies([wheel]);
    expect(tyre).toBe(wheel);
    expect(rest).toHaveLength(0);
    expect(rim!.color).toBe(RIM_COLOR);
    expect(rim!.material).toBe('metal');
    expect(rim!.size[1]).toBeCloseTo(0.3 * RIM_DIAMETER, 9);
    // Outer side (+x for a right wheel), within the tyre's outer half.
    expect(rim!.at[0]).toBeGreaterThan(wheel.at[0]);
    expect(rim!.at[0] + rim!.size[0] / 2).toBeLessThanOrEqual(wheel.at[0] + 0.06);
    const left = expandViewAssemblies([{ ...wheel, at: [-0.4, -0.35, 0.3] }])[1]!;
    expect(left.at[0]).toBeLessThan(-0.4);
  });

  it('a wheel without `rim`, or an axis-y cylinder, stays as it is', () => {
    expect(expandViewAssemblies([{ ...wheel, rim: undefined }])).toHaveLength(1);
    expect(expandViewAssemblies([{ ...wheel, axis: undefined }])).toHaveLength(1);
  });

  it('draws cols − 1 + rows − 1 cell lines, columns following the tilt, at full detail only', () => {
    const out = expandViewAssemblies([cells]);
    expect(out).toHaveLength(1 + 3 + 1);
    const lines = out.slice(1);
    expect(lines.every((l) => l.color === CELL_LINE_COLOR)).toBe(true);
    const columns = lines.filter((l) => l.shape === 'hull');
    expect(columns).toHaveLength(3);
    // Same tilt as the patch, lifted off it.
    expect(columns[0]!.section![0]![0]).toBeGreaterThan(cells.section![0]![0]);
    const row = lines.find((l) => l.shape === 'box')!;
    expect(row.at[1]).toBeCloseTo(0.05, 9);
    expect(row.at[2]).toBeGreaterThan(0.05);
    expect(expandViewAssemblies([cells], 'low')).toHaveLength(1);
  });
});
