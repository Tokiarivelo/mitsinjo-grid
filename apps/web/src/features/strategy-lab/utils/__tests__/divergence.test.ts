import { describe, expect, it } from 'vitest';
import type { Metrics, SweepPoint } from '@mitsinjo/engine';
import { findDivergencePoint } from '../divergence';

function mockMetrics(criticalUnservedKwh: number): Metrics {
  return {
    demandKwh: 100,
    servedKwh: 100 - criticalUnservedKwh,
    unservedKwh: criticalUnservedKwh,
    criticalDemandKwh: 20,
    criticalUnservedKwh,
    criticalUnmetHours: criticalUnservedKwh > 0 ? 1 : 0,
    criticalCoveragePct: ((20 - criticalUnservedKwh) / 20) * 100,
    lifelineCoveragePct: 100,
    affectedSectors: criticalUnservedKwh > 0 ? ['health'] : [],
    solarKwh: 120,
    curtailedKwh: 0,
    socStartPct: 50,
    socEndPct: 40,
    socMinPct: 30,
    violations: 0,
    perSector: {
      health: {
        demandKwh: 20,
        servedKwh: 20 - criticalUnservedKwh,
        unservedKwh: criticalUnservedKwh,
        coveragePct: ((20 - criticalUnservedKwh) / 20) * 100,
      },
      water: { demandKwh: 20, servedKwh: 20, unservedKwh: 0, coveragePct: 100 },
      school: { demandKwh: 20, servedKwh: 20, unservedKwh: 0, coveragePct: 100 },
      households: { demandKwh: 20, servedKwh: 20, unservedKwh: 0, coveragePct: 100 },
      market: { demandKwh: 20, servedKwh: 20, unservedKwh: 0, coveragePct: 100 },
    },
  };
}

describe('findDivergencePoint (PZ-T13)', () => {
  it('returns found: false for empty or single-strategy points', () => {
    expect(findDivergencePoint([])).toEqual({ found: false });

    const singleStrat: SweepPoint[] = [
      {
        value: 10,
        metrics: { proportional: mockMetrics(0) },
      },
    ];
    expect(findDivergencePoint(singleStrat)).toEqual({ found: false });
  });

  it('returns found: false when all strategies have difference <= 0.1 kWh', () => {
    const points: SweepPoint[] = [
      {
        value: 10,
        metrics: {
          proportional: mockMetrics(0),
          essential_first: mockMetrics(0),
          balanced: mockMetrics(0),
        },
      },
      {
        value: 20,
        metrics: {
          proportional: mockMetrics(0.08),
          essential_first: mockMetrics(0),
          balanced: mockMetrics(0.04),
        },
      },
    ];

    expect(findDivergencePoint(points, 0.1)).toEqual({ found: false });
  });

  it('detects the first point where difference exceeds 0.1 kWh', () => {
    const points: SweepPoint[] = [
      {
        value: 10,
        metrics: {
          proportional: mockMetrics(0),
          essential_first: mockMetrics(0),
        },
      },
      {
        value: 20,
        metrics: {
          proportional: mockMetrics(0.05),
          essential_first: mockMetrics(0),
        },
      },
      {
        value: 30,
        metrics: {
          proportional: mockMetrics(0.85),
          essential_first: mockMetrics(0.1),
        },
      },
      {
        value: 40,
        metrics: {
          proportional: mockMetrics(2.5),
          essential_first: mockMetrics(0.5),
        },
      },
    ];

    const result = findDivergencePoint(points, 0.1);
    expect(result.found).toBe(true);
    expect(result.value).toBe(30);
    expect(result.diff).toBeCloseTo(0.75);
    expect(result.bestStrategy).toBe('essential_first');
    expect(result.bestVal).toBeCloseTo(0.1);
    expect(result.worstStrategy).toBe('proportional');
    expect(result.worstVal).toBeCloseTo(0.85);
  });
});
