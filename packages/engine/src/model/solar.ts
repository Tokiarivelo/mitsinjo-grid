import type { ScenarioEvent, SolarConfig } from '../schemas';

export function computeSolarStep(
  solar: SolarConfig,
  events: readonly ScenarioEvent[],
  t: number
): number {
  let factorMultiplier = 1;

  for (const event of events) {
    if (
      event.type === 'solar_drop' &&
      t >= event.startHour &&
      t < event.startHour + event.durationH
    ) {
      factorMultiplier *= event.factor;
    }
  }

  const baseFraction = solar.profile[t] ?? 0;
  return Math.max(0, solar.peakKw * baseFraction * factorMultiplier);
}
