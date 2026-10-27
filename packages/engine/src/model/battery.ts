import type { BatteryConfig } from '../schemas';

export interface BatteryStepResult {
  storedKwh: number;
  batteryKw: number;
  curtailedKw: number;
  socPct: number;
}

export function computeDischargeMaxKw(
  battery: BatteryConfig,
  storedKwh: number
): { reserveKwh: number; dischargeMaxKw: number } {
  const reserveKwh = (battery.minSocPct / 100) * battery.capacityKwh;
  const usableKwh = Math.max(0, storedKwh - reserveKwh);
  const dischargeMaxKw = Math.max(
    0,
    Math.min(battery.maxDischargeKw, usableKwh * battery.dischargeEff)
  );

  return { reserveKwh, dischargeMaxKw };
}

export function computeBatteryStep(
  battery: BatteryConfig,
  storedKwh: number,
  solarKw: number,
  servedKw: number
): BatteryStepResult {
  const { reserveKwh, dischargeMaxKw } = computeDischargeMaxKw(battery, storedKwh);

  if (servedKw <= solarKw) {
    const surplus = solarKw - servedKw;
    const spaceKwh = Math.max(0, battery.capacityKwh - storedKwh);
    const chargeKw = Math.max(
      0,
      Math.min(surplus, battery.maxChargeKw, spaceKwh / battery.chargeEff)
    );
    const nextStoredKwh = Math.min(battery.capacityKwh, storedKwh + chargeKw * battery.chargeEff);
    const curtailedKw = Math.max(0, surplus - chargeKw);
    const batteryKw = chargeKw;
    const socPct = (nextStoredKwh / battery.capacityKwh) * 100;

    return {
      storedKwh: nextStoredKwh,
      batteryKw,
      curtailedKw,
      socPct,
    };
  }

  const drawKw = Math.min(servedKw - solarKw, dischargeMaxKw);
  const nextStoredKwh = Math.max(reserveKwh, storedKwh - drawKw / battery.dischargeEff);
  const curtailedKw = 0;
  const batteryKw = -drawKw;
  const socPct = (nextStoredKwh / battery.capacityKwh) * 100;

  return {
    storedKwh: nextStoredKwh,
    batteryKw,
    curtailedKw,
    socPct,
  };
}
