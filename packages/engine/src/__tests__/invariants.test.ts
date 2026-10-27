import { describe, expect, it } from 'vitest';
import { checkStepInvariants } from '../invariants';
import type { BatteryConfig, StepResult } from '../schemas';

const validBattery: BatteryConfig = {
  capacityKwh: 120,
  initialSocPct: 60,
  minSocPct: 20,
  maxChargeKw: 25,
  maxDischargeKw: 25,
  chargeEff: 0.95,
  dischargeEff: 0.95,
};

function createValidStep(): StepResult {
  return {
    t: 12,
    solarKw: 30,
    demandKw: 15,
    servedKw: 15,
    unservedKw: 0,
    batteryKw: 15,
    socPct: 65,
    curtailedKw: 0,
    sectors: {
      health: { demandKw: 3, servedKw: 3, criticalDemandKw: 2.4, criticalServedKw: 2.4 },
      water: { demandKw: 4, servedKw: 4, criticalDemandKw: 1.2, criticalServedKw: 1.2 },
      school: { demandKw: 2, servedKw: 2, criticalDemandKw: 0.2, criticalServedKw: 0.2 },
      households: { demandKw: 4, servedKw: 4, criticalDemandKw: 0.8, criticalServedKw: 0.8 },
      market: { demandKw: 2, servedKw: 2, criticalDemandKw: 0.2, criticalServedKw: 0.2 },
    },
  };
}

describe('Invariant Checker (P3-T5)', () => {
  it('returns 0 violations for valid physics step', () => {
    const step = createValidStep();
    const prevStored = 60;
    const newStored = prevStored + step.batteryKw * validBattery.chargeEff; // 60 + 15 * 0.95 = 74.25

    const violations = checkStepInvariants({
      t: 12,
      step,
      prevStoredKwh: prevStored,
      newStoredKwh: newStored,
      availableKw: 45,
      battery: validBattery,
    });

    expect(violations).toBe(0);
  });

  it('detects violations when values are non-finite', () => {
    const step = createValidStep();
    step.solarKw = NaN;

    const violations = checkStepInvariants({
      t: 12,
      step,
      prevStoredKwh: 60,
      newStoredKwh: 74.25,
      availableKw: 45,
      battery: validBattery,
    });

    expect(violations).toBeGreaterThan(0);
  });

  it('detects violations when served exceeds demand or critical served is invalid', () => {
    const step = createValidStep();
    const health = step.sectors.health;
    if (health) {
      health.servedKw = 10; // demand is 3
    }

    const violations = checkStepInvariants({
      t: 12,
      step,
      prevStoredKwh: 60,
      newStoredKwh: 74.25,
      availableKw: 45,
      battery: validBattery,
    });

    expect(violations).toBeGreaterThan(0);

    const stepCritInvalid = createValidStep();
    const healthCrit = stepCritInvalid.sectors.health;
    if (healthCrit) {
      healthCrit.criticalServedKw = 5; // exceeds criticalDemandKw 2.4
    }
    const violationsCrit = checkStepInvariants({
      t: 12,
      step: stepCritInvalid,
      prevStoredKwh: 60,
      newStoredKwh: 74.25,
      availableKw: 45,
      battery: validBattery,
    });
    expect(violationsCrit).toBeGreaterThan(0);
  });

  it('detects violations when served exceeds available power', () => {
    const step = createValidStep();
    step.servedKw = 50;

    const violations = checkStepInvariants({
      t: 12,
      step,
      prevStoredKwh: 60,
      newStoredKwh: 74.25,
      availableKw: 20, // available < served
      battery: validBattery,
    });

    expect(violations).toBeGreaterThan(0);
  });

  it('detects violations when battery exceeds capacity or drops below reserve', () => {
    const step = createValidStep();

    // Above capacity (120)
    const overCapacityViolations = checkStepInvariants({
      t: 12,
      step,
      prevStoredKwh: 110,
      newStoredKwh: 125,
      availableKw: 45,
      battery: validBattery,
    });
    expect(overCapacityViolations).toBeGreaterThan(0);

    // Below reserve (24 kWh)
    const underReserveViolations = checkStepInvariants({
      t: 12,
      step,
      prevStoredKwh: 25,
      newStoredKwh: 20,
      availableKw: 45,
      battery: validBattery,
    });
    expect(underReserveViolations).toBeGreaterThan(0);
  });

  it('detects violations when battery power exceeds max charge or discharge rates', () => {
    const stepOverCharge = createValidStep();
    stepOverCharge.batteryKw = 35; // max is 25
    const chargeViolations = checkStepInvariants({
      t: 12,
      step: stepOverCharge,
      prevStoredKwh: 60,
      newStoredKwh: 74.25,
      availableKw: 45,
      battery: validBattery,
    });
    expect(chargeViolations).toBeGreaterThan(0);

    const stepOverDischarge = createValidStep();
    stepOverDischarge.batteryKw = -35; // max is 25
    const dischargeViolations = checkStepInvariants({
      t: 12,
      step: stepOverDischarge,
      prevStoredKwh: 60,
      newStoredKwh: 74.25,
      availableKw: 45,
      battery: validBattery,
    });
    expect(dischargeViolations).toBeGreaterThan(0);
  });

  it('detects violations when energy balance fails (served != solar - battery - curtailed)', () => {
    const step = createValidStep();
    step.servedKw = 25;

    const violations = checkStepInvariants({
      t: 12,
      step,
      prevStoredKwh: 60,
      newStoredKwh: 74.25,
      availableKw: 45,
      battery: validBattery,
    });

    expect(violations).toBeGreaterThan(0);
  });
});
