import { ringRange, spanAt } from '@/lib/hull';
import type { RecipePart } from '@/lib/object-shape';
import type { AssemblyDetail } from './openings';

/**
 * Assemblies of objects built from their 2D view (PG-T21), expanded by the 3D view only (the
 * flat render scores the plain part): a metal rim on each wheel's outer face, thin grid lines
 * on a solar cell patch. Pure.
 */

/** Rim diameter as a share of the tyre's, and its thickness as a share of the tyre width. */
export const RIM_DIAMETER = 0.62;
export const RIM_THICK = 0.35;
/** Rim colour (model colour, not a UI token). */
export const RIM_COLOR = '#c8cdd2';
/** Cell line half-width and lift off the patch, unit space. */
export const CELL_LINE = 0.004;
const CELL_LIFT = 0.003;
export const CELL_LINE_COLOR = '#b9c3cf';

/** The wheel with its rim disc (axis x: outer face toward its own side; axis z: both faces). */
function withRim(p: RecipePart): RecipePart[] {
  if (p.kind !== 'wheel' || !p.rim || p.shape !== 'cylinder') return [p];
  if (p.axis !== 'x' && p.axis !== 'z') return [p];
  const axis: 0 | 2 = p.axis === 'x' ? 0 : 2;
  const across = p.size[axis]!;
  const t = across * RIM_THICK;
  const sides = axis === 0 ? [Math.sign(p.at[0]) || 1] : [1, -1];
  const rims = sides.map((s): RecipePart => {
    const at: [number, number, number] = [...p.at];
    // Flush with the tyre's face, a hair proud so it never z-fights.
    at[axis] = p.at[axis]! + s * (across / 2 - t / 2 + across * 0.02);
    const size: [number, number, number] = [
      p.size[0] * RIM_DIAMETER,
      p.size[1] * RIM_DIAMETER,
      p.size[2] * RIM_DIAMETER,
    ];
    size[axis] = t;
    return {
      shape: 'cylinder',
      axis: p.axis,
      at,
      size,
      color: RIM_COLOR,
      material: 'metal',
      kind: 'wheel',
      ...(p.status ? { status: p.status } : {}),
    };
  });
  return [p, ...rims];
}

/** The cell patch with its grid lines: columns follow the patch's tilt, rows sit on its face. */
function withCellGrid(p: RecipePart): RecipePart[] {
  if (p.kind !== 'cell' || !p.grid || p.shape !== 'hull' || !p.points || !p.section) return [p];
  const [cols, rows] = p.grid;
  const [x0, x1] = ringRange(p.points, 0);
  const [y0, y1] = ringRange(p.points, 1);
  const section = p.section;
  const look = {
    color: CELL_LINE_COLOR,
    material: 'metal' as const,
    kind: 'cell' as const,
    ...(p.status ? { status: p.status } : {}),
  };
  const lines: RecipePart[] = [];
  for (let i = 1; i < cols; i++) {
    const x = x0 + ((x1 - x0) * i) / cols;
    lines.push({
      shape: 'hull',
      at: [0, 0, 0],
      size: [1, 1, 1],
      // Inset from the patch ends so a line never pokes past the panel's edge.
      points: [
        [x - CELL_LINE, y0 + 2 * CELL_LINE],
        [x + CELL_LINE, y0 + 2 * CELL_LINE],
        [x + CELL_LINE, y1 - 2 * CELL_LINE],
        [x - CELL_LINE, y1 - 2 * CELL_LINE],
      ],
      section: section.map(([z, y]) => [z + CELL_LIFT, y] as [number, number]),
      ...look,
    });
  }
  for (let j = 1; j < rows; j++) {
    const y = y0 + ((y1 - y0) * j) / rows;
    const z = (spanAt(section, y) ?? ringRange(section, 0))[1];
    lines.push({
      shape: 'box',
      at: [(x0 + x1) / 2, y, z + CELL_LIFT],
      size: [x1 - x0, 2 * CELL_LINE, 2 * CELL_LIFT],
      ...look,
    });
  }
  return [p, ...lines];
}

/** Wheels with rims (every detail) and solar cells with grid lines (full detail only). */
export function expandViewAssemblies(
  parts: ReadonlyArray<RecipePart>,
  detail: AssemblyDetail = 'full'
): RecipePart[] {
  return parts.flatMap((p) =>
    withRim(p).flatMap((q) => (detail === 'full' ? withCellGrid(q) : [q]))
  );
}
