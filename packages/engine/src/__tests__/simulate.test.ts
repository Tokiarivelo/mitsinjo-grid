import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '../constants';
import { scenarios } from '../scenarios';
import { simulate } from '../simulate';

describe('simulate (P3-T5)', () => {
  it('returns valid simulation result with 24 steps', () => {
    const sim = simulate(scenarios.baseline.input, 'proportional');

    expect(sim.engineVersion).toBe(ENGINE_VERSION);
    expect(sim.strategy).toBe('proportional');
    expect(sim.steps).toHaveLength(24);
    expect(sim.id).toMatch(/^SIM-[0-9A-F]{6}$/);
    expect(sim.inputHash).toHaveLength(16);

    for (let t = 0; t < 24; t++) {
      const step = sim.steps[t];
      expect(step).toBeDefined();
      if (step) {
        expect(step.t).toBe(t);
        expect(Object.keys(step.sectors)).toEqual([
          'health',
          'water',
          'school',
          'households',
          'market',
        ]);
      }
    }
  });

  it('aggregates step sums into metrics correctly', () => {
    const sim = simulate(scenarios.cloudy_afternoon.input, 'proportional');

    const totalDemandKw = sim.steps.reduce((acc, s) => acc + s.demandKw, 0);
    const totalServedKw = sim.steps.reduce((acc, s) => acc + s.servedKw, 0);
    const totalUnservedKw = sim.steps.reduce((acc, s) => acc + s.unservedKw, 0);
    const totalSolarKw = sim.steps.reduce((acc, s) => acc + s.solarKw, 0);
    const totalCurtailedKw = sim.steps.reduce((acc, s) => acc + s.curtailedKw, 0);

    expect(sim.metrics.demandKwh).toBeCloseTo(totalDemandKw, 6);
    expect(sim.metrics.servedKwh).toBeCloseTo(totalServedKw, 6);
    expect(sim.metrics.unservedKwh).toBeCloseTo(totalUnservedKw, 6);
    expect(sim.metrics.solarKwh).toBeCloseTo(totalSolarKw, 6);
    expect(sim.metrics.curtailedKwh).toBeCloseTo(totalCurtailedKw, 6);
  });

  it('generates and merges consecutive warnings into ranges', () => {
    const sim = simulate(scenarios.cloudy_afternoon.input, 'proportional');

    expect(sim.warnings.length).toBeGreaterThan(0);
    for (const w of sim.warnings) {
      expect(w.fromHour).toBeLessThanOrEqual(w.toHour);
      expect(w.fromHour).toBeGreaterThanOrEqual(0);
      expect(w.toHour).toBeLessThanOrEqual(23);
      expect(['CRITICAL_UNMET', 'SECTOR_PARTIAL', 'RESERVE_REACHED', 'CURTAILMENT']).toContain(
        w.code
      );
    }
  });

  describe('PY-T1: Sector control proposals & capacity caps', () => {
    it('strictly respects sectorCaps invariant served_s <= cap_s + EPS and maintains energy balance', () => {
      const input = structuredClone(scenarios.cloudy_afternoon.input);
      input.sectorCaps = [
        {
          sector: 'market',
          maxKw: 0.5,
          fromHour: 10,
          toHour: 16,
        },
      ];

      const sim = simulate(input, 'proportional');
      expect(sim.metrics.violations).toBe(0);

      // Verify cap on market during 10..15h
      for (let t = 10; t < 16; t++) {
        const step = sim.steps[t]!;
        const marketStep = step.sectors.market!;
        expect(marketStep.servedKw).toBeLessThanOrEqual(0.5 + 1e-9);
      }

      // Verify SECTOR_CAPPED warning
      const capWarning = sim.warnings.find((w) => w.code === 'SECTOR_CAPPED');
      expect(capWarning).toBeDefined();
      expect(capWarning?.sector).toBe('market');
    });

    it('reallocates freed power to other sectors', () => {
      // At midday (hour 12), total demand is 8.7 kW (health 1.2, water 3.0, school 1.5, market 2.0, households 1.0).
      // With peakKw = 10 and battery at minSoc, solar provides ~4.85 kW (< 8.7 kW demand), causing a deficit.
      const input = structuredClone(scenarios.baseline.input);
      input.solar.peakKw = 10;
      input.battery.initialSocPct = 20.001;
      input.battery.minSocPct = 20;

      const cappedInput = structuredClone(input);
      cappedInput.sectorCaps = [
        {
          sector: 'market',
          maxKw: 0,
          fromHour: 12,
          toHour: 13,
        },
      ];

      const simUncapped = simulate(input, 'proportional');
      const simCapped = simulate(cappedInput, 'proportional');

      const uncappedHealth = simUncapped.steps[12]!.sectors.health!.servedKw;
      const cappedHealth = simCapped.steps[12]!.sectors.health!.servedKw;

      expect(cappedHealth).toBeGreaterThan(uncappedHealth);
      expect(simCapped.steps[12]!.sectors.market!.servedKw).toBe(0);
      expect(simUncapped.steps[12]!.sectors.market!.servedKw).toBeGreaterThan(0.5);
    });

    it('no cap = identical result & id', () => {
      const inputWithoutCaps = scenarios.cloudy_afternoon.input;
      const inputWithEmptyCaps = structuredClone(scenarios.cloudy_afternoon.input);
      inputWithEmptyCaps.sectorCaps = [];

      const res1 = simulate(inputWithoutCaps, 'proportional');
      const res2 = simulate(inputWithEmptyCaps, 'proportional');

      expect(res1.id).toBe(res2.id);
      expect(res1.inputHash).toBe(res2.inputHash);
      expect(res1.metrics.servedKwh).toBe(res2.metrics.servedKwh);
    });
  });

  describe('PX-T1 & PX-T2: Meter readings override & anomaly detector', () => {
    it('overrides sector demand with meterReadings and detects persistent gap > 25% for >= 2h', () => {
      const input = structuredClone(scenarios.baseline.input);
      const market = input.sectors.find((s) => s.id === 'market')!;
      // Normal market demand is 2 kW 08..17h.
      // Inject meterReadings with 3.0 kW (+50% gap) at 12..14h (2 hours >= 2h)
      market.meterReadings = market.profileKw.map((kw, h) => (h === 12 || h === 13 ? 3.0 : kw));

      const sim = simulate(input, 'proportional');
      // Market demand overridden at hour 12
      expect(sim.steps[12]!.sectors.market!.demandKw).toBe(3.0);

      // Warning ANOMALY_TO_VERIFY generated
      const anomalyWarn = sim.warnings.find((w) => w.code === 'ANOMALY_TO_VERIFY');
      expect(anomalyWarn).toBeDefined();
      expect(anomalyWarn?.sector).toBe('market');
      expect(anomalyWarn?.fromHour).toBe(12);
      expect(anomalyWarn?.toHour).toBe(13);
    });

    it('does NOT trigger ANOMALY_TO_VERIFY for an isolated 1-hour gap (< 2h)', () => {
      const input = structuredClone(scenarios.baseline.input);
      const market = input.sectors.find((s) => s.id === 'market')!;
      // Divergence at only hour 12 (1 hour)
      market.meterReadings = market.profileKw.map((kw, h) => (h === 12 ? 3.5 : kw));

      const sim = simulate(input, 'proportional');
      const anomalyWarn = sim.warnings.find((w) => w.code === 'ANOMALY_TO_VERIFY');
      expect(anomalyWarn).toBeUndefined();
    });

    it('does NOT trigger ANOMALY_TO_VERIFY when divergence is <= 25%', () => {
      const input = structuredClone(scenarios.baseline.input);
      const market = input.sectors.find((s) => s.id === 'market')!;
      // Divergence is 2.3 kW vs 2.0 kW (+15% <= 25%) for 4 hours
      market.meterReadings = market.profileKw.map((kw, h) =>
        h >= 10 && h < 14 ? 2.3 : kw
      );

      const sim = simulate(input, 'proportional');
      const anomalyWarn = sim.warnings.find((w) => w.code === 'ANOMALY_TO_VERIFY');
      expect(anomalyWarn).toBeUndefined();
    });
  });
});
