import { describe, expect, it } from 'vitest';
import {
  applianceProfileKw,
  applyPatch,
  MAX_APPLIANCES,
  scenarios,
  SECTOR_IDS,
  simulate,
  type Appliance,
} from '@mitsinjo/engine';
import { applianceMarkers, appliancesPerSector, MARKER_RING } from '../appliance-markers';
import { SECTOR_POSITIONS, toSceneModel } from '../to-scene-model';

const pump: Appliance = {
  id: 'p1',
  name: 'Pump',
  category: 'water_pump',
  sector: 'water',
  watts: 750,
  quantity: 2,
};
const base = scenarios.cloudy_afternoon.input;

describe('applianceMarkers (PV-T13)', () => {
  it('no appliances → no markers; the scene model carries them', () => {
    expect(applianceMarkers(undefined, SECTOR_POSITIONS, 12)).toEqual([]);
    const input = applyPatch(base, { appliances: [pump] });
    const model = toSceneModel({ input, result: simulate(input, 'proportional'), timeIndex: 12 });
    expect(model.appliances).toHaveLength(1);
    expect(toSceneModel({ input: base }).appliances).toEqual([]);
  });

  it('kW at the hour is the engine profile; glows only when drawing power in a served sector', () => {
    const input = applyPatch(base, { appliances: [pump] });
    const result = simulate(input, 'proportional');
    for (const t of [3, 12, 20]) {
      const [m] = applianceMarkers(input.appliances, SECTOR_POSITIONS, t, result);
      expect(m!.kwNow).toBeCloseTo(applianceProfileKw(pump)[t]!, 12);
      const served = (result.steps[t]!.sectors.water?.servedKw ?? 0) > 0.05;
      expect(m!.running).toBe(served && m!.kwNow > 1e-4);
    }
    // No result yet: nothing glows.
    expect(applianceMarkers([pump], SECTOR_POSITIONS, 12)[0]!.running).toBe(false);
  });

  it('30 lines: all on the outer side of their building, never on top of each other', () => {
    const list: Appliance[] = Array.from({ length: MAX_APPLIANCES }, (_, i) => ({
      ...pump,
      id: `a${i}`,
      sector: SECTOR_IDS[i % 2]!,
    }));
    const markers = applianceMarkers(list, SECTOR_POSITIONS, 12);
    for (const m of markers) {
      const [bx, , bz] = SECTOR_POSITIONS[m.sector];
      expect(Math.hypot(m.position[0], m.position[2])).toBeGreaterThan(Math.hypot(bx, bz));
      expect(Math.hypot(m.position[0] - bx, m.position[2] - bz)).toBeGreaterThanOrEqual(
        MARKER_RING - 1e-9
      );
    }
    for (let i = 0; i < markers.length; i++)
      for (let j = i + 1; j < markers.length; j++) {
        const a = markers[i]!.position;
        const b = markers[j]!.position;
        expect(Math.hypot(a[0] - b[0], a[2] - b[2])).toBeGreaterThan(0.5);
      }
    expect(appliancesPerSector(list)).toMatchObject({ health: 15, water: 15, school: 0 });
  });
});
