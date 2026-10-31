import { describe, expect, it } from 'vitest';
import { scenarios, simulate } from '@mitsinjo/engine';
import { feederTone, hasFeederTag } from '../feeder-tone';
import { toSceneModel } from '../to-scene-model';
import type { BuildingSceneModel, FeederSceneModel } from '../../types';

const feeder = (over: Partial<FeederSceneModel> = {}): FeederSceneModel => ({
  mode: 'full',
  servedKw: 2,
  intensity: 1,
  share: 0.5,
  breaker: 'closed',
  ...over,
});

const building = (over: Partial<BuildingSceneModel> = {}): BuildingSceneModel => ({
  id: 'health',
  nameKey: 'sectors.health',
  position: [0, 0, 0],
  priority: 'critical',
  demandKw: 2,
  servedKw: 2,
  unservedKw: 0,
  coveragePct: 100,
  status: 'full',
  statusColor: 'battery-green',
  isCritical: true,
  connected: true,
  loadMultiplier: 1,
  intensity: 1,
  mode: 'full',
  onFire: false,
  ...over,
});

describe('feederTone', () => {
  it('follows the sector status when the breaker is closed', () => {
    expect(feederTone(feeder(), building())).toBe('battery-green');
    expect(
      feederTone(
        feeder(),
        building({ servedKw: 1, status: 'partial', statusColor: 'warning-amber' })
      )
    ).toBe('warning-amber');
  });

  it('shows the limiter in amber and a shed feeder in red', () => {
    expect(feederTone(feeder({ breaker: 'limited' }), building())).toBe('warning-amber');
    expect(
      feederTone(
        feeder({ breaker: 'open', servedKw: 0 }),
        building({ servedKw: 0, status: 'unserved', statusColor: 'critical-red' })
      )
    ).toBe('critical-red');
  });

  it('stays neutral for an open feeder with no demand or a disconnected sector', () => {
    expect(feederTone(feeder({ breaker: 'open' }), building({ status: 'unknown' }))).toBe('idle');
    expect(feederTone(feeder(), building({ connected: false }))).toBe('idle');
    // Closed breaker but nothing to carry this hour: neutral, not "powered" green.
    expect(feederTone(feeder({ servedKw: 0 }), building({ demandKw: 0, servedKw: 0 }))).toBe(
      'idle'
    );
  });

  it('tags only feeders with demand or flow (a shed sector keeps its tag)', () => {
    expect(hasFeederTag(building())).toBe(true);
    expect(hasFeederTag(building({ servedKw: 0, status: 'unserved' }))).toBe(true);
    expect(hasFeederTag(building({ demandKw: 0, servedKw: 0 }))).toBe(false);
    expect(hasFeederTag(building({ connected: false }))).toBe(false);
  });

  it('gives every sector of a real run a tone, and shares sum to 1 when power flows', () => {
    const input = scenarios.essential_stress.input;
    const m = toSceneModel({ input, result: simulate(input, 'proportional'), timeIndex: 12 });
    const feeders = Object.values(m.controller.feeders);
    const total = feeders.reduce((s, f) => s + f.share, 0);
    expect(total).toBeCloseTo(1, 5);
    for (const b of Object.values(m.buildings)) {
      expect(feederTone(m.controller.feeders[b.id], b)).toBeTypeOf('string');
    }
  });
});
