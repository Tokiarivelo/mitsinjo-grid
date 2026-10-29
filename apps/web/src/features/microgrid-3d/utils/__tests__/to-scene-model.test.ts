import { describe, it, expect } from 'vitest';
import { SECTOR_IDS, applyPatch, scenarios, simulate } from '@mitsinjo/engine';
import { KEEP_OUT_ZONES } from '../landscape';
import { toSceneModel, SECTOR_POSITIONS } from '../to-scene-model';
import { STATUS_HEX } from '../scene-palette';

describe('toSceneModel pure mapping (P7-T1)', () => {
  const baselineInput = scenarios.baseline.input;

  it('handles empty/null simulation result gracefully with default baseline values', () => {
    const model = toSceneModel({
      input: baselineInput,
      result: null,
      timeIndex: 12,
    });

    expect(model.hasResult).toBe(false);
    expect(model.timeIndex).toBe(12);
    expect(model.timeLabel).toBe('12:00');
    expect(model.isDaytime).toBe(true);
    expect(model.solar.currentKw).toBe(0);
    expect(model.solar.glowIntensity).toBe(0);
    expect(model.battery.socPct).toBe(baselineInput.battery.initialSocPct);
    expect(model.buildings.health.demandKw).toBe(0);
    expect(model.buildings.health.servedKw).toBe(0);
    // No result → no invented coverage (badge shows "—", neutral color).
    expect(model.buildings.health.status).toBe('unknown');
    expect(model.buildings.health.statusColor).toBe('idle');
    expect(model.buildings.health.coveragePct).toBeNull();
  });

  it('correctly maps solar generation, glow, and daylight metrics at noon', () => {
    const result = simulate(baselineInput, 'proportional');
    const noonModel = toSceneModel({
      input: baselineInput,
      result,
      timeIndex: 12,
    });

    expect(noonModel.hasResult).toBe(true);
    expect(noonModel.isDaytime).toBe(true);
    expect(noonModel.sunElevation).toBeGreaterThan(0.9);
    expect(noonModel.sunIntensity).toBeGreaterThan(0.9);
    expect(noonModel.solar.currentKw).toBeGreaterThan(0);
    expect(noonModel.solar.glowIntensity).toBeGreaterThan(0);
    expect(noonModel.solar.isGenerating).toBe(true);
    expect(noonModel.lines.solarToBattery.active).toBe(true);
  });

  it('maps night conditions at 23:00 with zero solar glow and zero sun intensity', () => {
    const result = simulate(baselineInput, 'proportional');
    const nightModel = toSceneModel({
      input: baselineInput,
      result,
      timeIndex: 23,
    });

    expect(nightModel.isDaytime).toBe(false);
    expect(nightModel.sunElevation).toBe(0);
    expect(nightModel.sunIntensity).toBe(0);
    expect(nightModel.solar.currentKw).toBe(0);
    expect(nightModel.solar.glowIntensity).toBe(0);
    expect(nightModel.solar.isGenerating).toBe(false);
    expect(nightModel.lines.solarToBattery.active).toBe(false);
  });

  it('correctly reflects battery charge and discharge state', () => {
    const result = simulate(baselineInput, 'proportional');

    // Daytime charging (usually noon)
    const noon = toSceneModel({
      input: baselineInput,
      result,
      timeIndex: 12,
    });
    if (noon.battery.flowKw > 0) {
      expect(noon.battery.isCharging).toBe(true);
      expect(noon.battery.isDischarging).toBe(false);
    }
    // The hub→bus feeder carries the engine's served power toward the village.
    const noonStep = result.steps[12]!;
    expect(noon.lines.batteryToBus.flowKw).toBe(noonStep.servedKw);
    expect(noon.lines.batteryToBus.direction).toBe(noonStep.servedKw > 0.05 ? 'forward' : 'idle');

    // Evening discharging (e.g. 20:00)
    const evening = toSceneModel({
      input: baselineInput,
      result,
      timeIndex: 20,
    });
    if (evening.battery.flowKw < 0) {
      expect(evening.battery.isDischarging).toBe(true);
      expect(evening.battery.isCharging).toBe(false);
      // Discharging still feeds the village: never flows back into the hub.
      expect(evening.lines.batteryToBus.direction).toBe('forward');
    }
  });

  it('flags unserved and partial status correctly under deficit scenario', () => {
    const stress = scenarios.essential_stress.input;
    const result = simulate(stress, 'proportional');

    // Find the hour that actually experiences unserved load
    const deficitStepIndex = result.steps.findIndex((s) => s.unservedKw > 0);
    expect(deficitStepIndex).toBeGreaterThanOrEqual(0);

    const model = toSceneModel({
      input: stress,
      result,
      timeIndex: deficitStepIndex,
      strategy: 'proportional',
    });

    // Check that at least one sector experiences deficit
    const sectors = Object.values(model.buildings);
    const deficitSector = sectors.find((s) => s.status !== 'full');
    expect(deficitSector).toBeDefined();
    if (deficitSector) {
      expect(deficitSector.unservedKw).toBeGreaterThan(0);
      expect(deficitSector.statusColor).toMatch(/warning-amber|critical-red/);
    }
  });

  it('assigns correct canonical positions to all 5 buildings', () => {
    const model = toSceneModel({ input: baselineInput });

    expect(model.buildings.health.position).toEqual(SECTOR_POSITIONS.health);
    expect(model.buildings.water.position).toEqual(SECTOR_POSITIONS.water);
    expect(model.buildings.school.position).toEqual(SECTOR_POSITIONS.school);
    expect(model.buildings.households.position).toEqual(SECTOR_POSITIONS.households);
    expect(model.buildings.market.position).toEqual(SECTOR_POSITIONS.market);
  });
});

describe('toSceneModel palette & modified flag (PR #10 review)', () => {
  const input = scenarios.baseline.input;
  const result = simulate(input, 'proportional');

  it('colors sector lines with the design-token status color', () => {
    const model = toSceneModel({ input, result, timeIndex: 12 });
    for (const b of Object.values(model.buildings)) {
      expect(model.lines.busToSectors[b.id].color).toBe(STATUS_HEX[b.statusColor]);
    }
  });

  it('passes the modified flag through so the scene can freeze', () => {
    expect(toSceneModel({ input, result, isModified: true }).isModified).toBe(true);
  });

  it('places every engine sector, each with its own tree-free clearing', () => {
    const model = toSceneModel({ input: scenarios.baseline.input, result: null, timeIndex: 12 });
    expect(Object.keys(model.buildings).sort()).toEqual([...SECTOR_IDS].sort());
    for (const id of SECTOR_IDS) {
      const [x, , z] = SECTOR_POSITIONS[id];
      expect(KEEP_OUT_ZONES.some((k) => Math.hypot(k.x - x, k.z - z) < 0.01)).toBe(true);
    }
  });

  it('shows the factory as not connected by default (no coverage, idle color)', () => {
    const result = simulate(scenarios.baseline.input, 'essential_first');
    const model = toSceneModel({ input: scenarios.baseline.input, result, timeIndex: 10 });
    const factory = model.buildings.industry;
    expect(factory.connected).toBe(false);
    expect(factory.status).toBe('disconnected');
    expect(factory.statusColor).toBe('idle');
    expect(factory.coveragePct).toBeNull();
    expect(model.lines.busToSectors.industry.active).toBe(false);
  });

  it('lights the factory once connected (load from the engine result)', () => {
    const input = applyPatch(scenarios.baseline.input, { sectorLoads: { industry: 1 } });
    const result = simulate(input, 'proportional');
    const model = toSceneModel({ input, result, timeIndex: 10 });
    const factory = model.buildings.industry;
    expect(factory.connected).toBe(true);
    expect(factory.loadMultiplier).toBe(1);
    expect(factory.demandKw).toBeCloseTo(result.steps[10]!.sectors.industry!.demandKw);
    expect(factory.status).not.toBe('disconnected');
  });

  describe('controller scene model (PL-T5)', () => {
    it('initializes controller in normal mode when result is null', () => {
      const model = toSceneModel({ input: scenarios.baseline.input, result: null, timeIndex: 12 });
      expect(model.controller).toBeDefined();
      expect(model.controller.mode).toBe('normal');
      for (const id of SECTOR_IDS) {
        expect(model.controller.feeders[id].mode).toBe('off');
        expect(model.controller.feeders[id].breaker).toBe('open');
        expect(model.controller.feeders[id].intensity).toBe(0);
      }
    });

    it('sets controller mode to normal at noon with full generation and breakers closed', () => {
      const result = simulate(scenarios.baseline.input, 'proportional');
      const model = toSceneModel({ input: scenarios.baseline.input, result, timeIndex: 12 });
      expect(model.controller.mode).toBe('normal');
      // Connected sectors with demand are closed and have intensity > 0
      expect(model.controller.feeders.health.breaker).toBe('closed');
      expect(model.controller.feeders.health.intensity).toBeGreaterThan(0);
      expect(model.controller.feeders.health.intensity).toBeLessThanOrEqual(1);
      // Disconnected sector remains open with 0 intensity
      expect(model.controller.feeders.industry.breaker).toBe('open');
      expect(model.controller.feeders.industry.intensity).toBe(0);
    });

    it('sets controller mode to rationing when some sectors are constrained', () => {
      const stressInput = scenarios.essential_stress.input;
      const result = simulate(stressInput, 'proportional');
      // An hour outside any lifeline shortfall where the engine rations a sector.
      const inShortfall = (t: number) =>
        result.warnings.some(
          (w) => w.code === 'LIFELINE_SHORTFALL' && t >= w.fromHour && t <= w.toHour
        );
      const deficitStepIndex = result.steps.findIndex(
        (s) => !inShortfall(s.t) && Object.values(s.sectors).some((sec) => sec.mode === 'limited')
      );
      expect(deficitStepIndex).toBeGreaterThanOrEqual(0);
      const model = toSceneModel({ input: stressInput, result, timeIndex: deficitStepIndex });
      expect(model.controller.mode).toBe('rationing');
    });

    it('sets controller mode to lifeline_only in emergency or survie-seule step', () => {
      // Create a scenario with severe solar drop and tiny battery to force emergency / lifeline shortfall
      const emergencyInput = applyPatch(scenarios.essential_stress.input, {
        solarDropPct: 90,
        dropStartHour: 0,
        dropDurationH: 24,
        batteryCapacityKwh: 5,
        minSocPct: 20,
        initialSocPct: 21,
      });
      const result = simulate(emergencyInput, 'essential_first');
      const shortfallStep = result.steps.findIndex(
        (s) =>
          result.warnings.some(
            (w) => w.code === 'LIFELINE_SHORTFALL' && s.t >= w.fromHour && s.t <= w.toHour
          ) ||
          (s.unservedKw > 0 &&
            Object.values(s.sectors).every(
              (sec) => sec.demandKw === 0 || sec.mode === 'lifeline' || sec.mode === 'off'
            ))
      );
      expect(shortfallStep).toBeGreaterThanOrEqual(0);

      const model = toSceneModel({
        input: emergencyInput,
        result,
        timeIndex: shortfallStep,
      });

      expect(model.controller.mode).toBe('lifeline_only');
      // In emergency, health and water get lifeline power, breaker is limited
      const healthFeeder = model.controller.feeders.health;
      if (healthFeeder.mode === 'lifeline') {
        expect(healthFeeder.breaker).toBe('limited');
      }
    });
  });
});
