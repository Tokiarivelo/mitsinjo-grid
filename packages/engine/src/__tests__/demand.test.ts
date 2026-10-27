import { describe, expect, it } from 'vitest';
import { computeProfileDemandKw } from '../model/demand';
import { createBaselineInput } from '../scenarios';
import { simulate } from '../simulate';

describe('computeProfileDemandKw (PX-T1)', () => {
  it('applies demandMultiplier and active demand_spike factors, ignoring meterReadings', () => {
    const input = createBaselineInput();
    const market = input.sectors.find((s) => s.id === 'market')!;
    market.meterReadings = market.profileKw.map(() => 99);
    const events = [
      { type: 'demand_spike' as const, sector: 'market' as const, startHour: 12, durationH: 2, factor: 1.5 },
    ];

    const base = market.profileKw[12]!;
    expect(computeProfileDemandKw(market, 1.2, events, 12)).toBeCloseTo(base * 1.2 * 1.5);
    expect(computeProfileDemandKw(market, 1.2, events, 14)).toBeCloseTo(market.profileKw[14]! * 1.2);
  });

  it('does not flag ANOMALY_TO_VERIFY when meter readings follow a demand spike', () => {
    const input = createBaselineInput();
    input.events.push({ type: 'demand_spike', sector: 'market', startHour: 11, durationH: 3, factor: 1.5 });
    const market = input.sectors.find((s) => s.id === 'market')!;
    market.meterReadings = market.profileKw.map((_, h) =>
      computeProfileDemandKw(market, input.demandMultiplier, input.events, h)
    );

    const sim = simulate(input, 'proportional');
    expect(sim.warnings.find((w) => w.code === 'ANOMALY_TO_VERIFY')).toBeUndefined();
  });
});
