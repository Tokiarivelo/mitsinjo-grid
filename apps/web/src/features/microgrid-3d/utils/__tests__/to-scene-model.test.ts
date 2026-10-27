import { describe, it, expect } from 'vitest';
import { scenarios, simulate } from '@mitsinjo/engine';
import { toSceneModel, SECTOR_POSITIONS } from '../to-scene-model';

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
    expect(model.buildings.health.status).toBe('full');
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
      expect(noon.lines.batteryToBus.direction).toBe('forward');
    }

    // Evening discharging (e.g. 20:00)
    const evening = toSceneModel({
      input: baselineInput,
      result,
      timeIndex: 20,
    });
    if (evening.battery.flowKw < 0) {
      expect(evening.battery.isDischarging).toBe(true);
      expect(evening.battery.isCharging).toBe(false);
      expect(evening.lines.batteryToBus.direction).toBe('backward');
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
