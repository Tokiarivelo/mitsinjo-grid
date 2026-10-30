import { describe, expect, it } from 'vitest';
import { ANCHOR_HEIGHT, mapPolesToSectors, pointAlongCable, routeCable } from '../cable-route';
import type { LineFlowSceneModel } from '../../types';

function dummyLine(
  from: [number, number, number],
  to: [number, number, number]
): LineFlowSceneModel {
  return {
    from,
    to,
    active: true,
    flowKw: 2.5,
    direction: 'forward',
    speed: 1.2,
    color: '#50d8e8',
  };
}

describe('cable-route', () => {
  it('places utility poles between anchors with catenary sag', () => {
    const route = routeCable([0, 0, 0], [10, 0, 0], { spacing: 4.5 });
    expect(route.poles.length).toBeGreaterThan(0);
    expect(route.points[0]![1]).toBe(ANCHOR_HEIGHT);
    expect(route.points[route.points.length - 1]![1]).toBe(ANCHOR_HEIGHT);

    // Verify sag: points inside a span dip below the anchor height
    const spanDipPoint = route.points[2]!;
    expect(spanDipPoint[1]).toBeLessThan(ANCHOR_HEIGHT);
  });

  it('samples points along cable clamped to endpoints', () => {
    const route = routeCable([0, 0, 0], [10, 0, 0]);
    const start = pointAlongCable(route.points, 0);
    const end = pointAlongCable(route.points, 1);
    const middle = pointAlongCable(route.points, 0.5);

    expect(start[0]).toBeCloseTo(0);
    expect(end[0]).toBeCloseTo(10);
    expect(middle[0]).toBeCloseTo(5, 0);
  });

  it('maps distribution poles to their sector feeders (PL-T10)', () => {
    const lines = {
      solarToBattery: dummyLine([-10, 0, -4], [-2, 0, 0]),
      batteryToBus: dummyLine([-2, 0, 0], [0, 0, 1]),
      busToSectors: {
        health: dummyLine([0.15, 2.7, 1.45], [9, 0, 1]),
        water: dummyLine([-0.55, 2.7, 0.7], [-8, 0, 5]),
      },
    };

    const mapped = mapPolesToSectors(lines);
    expect(mapped.length).toBeGreaterThan(0);

    // Sector poles should carry their respective sector ID
    const healthPoles = mapped.filter((p) => p.sectorId === 'health');
    const waterPoles = mapped.filter((p) => p.sectorId === 'water');
    expect(healthPoles.length).toBeGreaterThan(0);
    expect(waterPoles.length).toBeGreaterThan(0);

    // Trunk line poles should have null sectorId
    const trunkPoles = mapped.filter((p) => p.sectorId === null);
    expect(trunkPoles.length).toBeGreaterThanOrEqual(1);
  });
});
