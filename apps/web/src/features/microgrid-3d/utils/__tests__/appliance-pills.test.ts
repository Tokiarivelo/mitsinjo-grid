import { describe, expect, it } from 'vitest';
import type { SectorId } from '@mitsinjo/engine';
import {
  DIAGRAM_H,
  DIAGRAM_SECTORS,
  DIAGRAM_W,
  boxesOverlap,
  diagramLayout,
  segmentCrossesBox,
  type Box,
} from '../diagram-layout';
import { appliancePills, layoutBoxes, type AppliancePillInput } from '../appliance-pills';

const variants = ['topology', 'circuit'] as const;

function list(perSector: number, ems: number): AppliancePillInput[] {
  const out: AppliancePillInput[] = [];
  for (const sector of DIAGRAM_SECTORS) {
    for (let i = 0; i < perSector; i++) out.push({ id: `${sector}-${i}`, sector });
  }
  for (let i = 0; i < ems; i++)
    out.push({ id: `ems-${i}`, sector: 'water', connectionMode: 'ems' });
  return out;
}

describe('appliancePills', () => {
  it.each(variants)('%s: one appliance per sector and one on the EMS all get a card', (v) => {
    const apps = list(1, 1);
    const pills = appliancePills(apps, v, diagramLayout(v));
    for (const a of apps) expect(pills[a.id], a.id).toBeDefined();
  });

  it.each(variants)('%s: cards stay in the viewBox, clear of labels, wires and each other', (v) => {
    const layout = diagramLayout(v);
    const pills = Object.values(appliancePills(list(3, 2), v, layout));
    expect(pills.length).toBeGreaterThan(6);
    const fixed = layoutBoxes(layout);
    const boxes: Box[] = pills.map((p) => p.box);
    for (const [i, b] of boxes.entries()) {
      expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= DIAGRAM_W && b.y + b.h <= DIAGRAM_H).toBe(true);
      for (const f of fixed) expect(boxesOverlap(b, f), `pill ${i}`).toBe(false);
      for (const [j, o] of boxes.entries()) if (j !== i) expect(boxesOverlap(b, o)).toBe(false);
    }
    for (const p of pills) {
      for (let k = 1; k < p.route.length; k++) {
        for (const f of [...fixed, ...boxes.filter((b) => b !== p.box)]) {
          expect(segmentCrossesBox(p.route[k - 1]!, p.route[k]!, f)).toBe(false);
        }
      }
    }
  });

  it('topology: a branch card is wired to its own sector feeder', () => {
    const layout = diagramLayout('topology');
    for (const sector of DIAGRAM_SECTORS as readonly SectorId[]) {
      const pill = appliancePills([{ id: 'a', sector }], 'topology', layout).a!;
      const [tx, ty] = pill.route[0]!;
      const feeder = layout.wires.busToSector[sector];
      const onFeeder = feeder.slice(1).some(([x2, y2], k) => {
        const [x1, y1] = feeder[k]!;
        return (
          tx >= Math.min(x1, x2) &&
          tx <= Math.max(x1, x2) &&
          ty >= Math.min(y1, y2) &&
          ty <= Math.max(y1, y2)
        );
      });
      expect(onFeeder, sector).toBe(true);
    }
  });

  it('is deterministic and fast enough for the 30-line cap', () => {
    const layout = diagramLayout('topology');
    const apps = list(5, 0);
    const t0 = performance.now();
    const a = appliancePills(apps, 'topology', layout);
    expect(performance.now() - t0).toBeLessThan(1500);
    expect(appliancePills(apps, 'topology', layout)).toEqual(a);
  });
});
