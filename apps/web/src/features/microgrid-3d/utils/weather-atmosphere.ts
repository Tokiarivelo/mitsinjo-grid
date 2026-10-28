import type { WeatherId } from '@mitsinjo/engine';
import { mulberry32 } from './noise';

/**
 * How a day's weather looks in the 3D scene. Visual only: solar output always comes
 * from the engine result (the engine already scales the solar profile per weather).
 */
export interface WeatherAtmosphere {
  /** Share of the sky covered by cloud banks (0 clear – 1 full). */
  cloudCover: number;
  /** 0 = clear-sky palette, 1 = fully grey overcast light. */
  overcast: number;
  /** Rain density (0 none – 1 downpour). */
  rain: number;
  /** Storm lightning flashes (disabled under reduced motion). */
  lightning: boolean;
  /** Cloud tint: 0 white, 1 dark storm grey. */
  cloudDarkness: number;
}

export const WEATHER_ATMOSPHERE: Record<WeatherId, WeatherAtmosphere> = {
  sunny: { cloudCover: 0.12, overcast: 0, rain: 0, lightning: false, cloudDarkness: 0 },
  partly_cloudy: { cloudCover: 0.5, overcast: 0.22, rain: 0, lightning: false, cloudDarkness: 0.1 },
  cloudy: { cloudCover: 0.85, overcast: 0.6, rain: 0, lightning: false, cloudDarkness: 0.35 },
  rainy: { cloudCover: 1, overcast: 0.8, rain: 0.6, lightning: false, cloudDarkness: 0.55 },
  storm: { cloudCover: 1, overcast: 0.95, rain: 1, lightning: true, cloudDarkness: 0.8 },
};

/** Most cloud banks drawn (full cover). */
export const MAX_CLOUD_BANKS = 18;
/** Puffs per cloud bank. */
export const PUFFS_PER_BANK = 5;

export interface CloudPuff {
  position: [number, number, number];
  scale: [number, number, number];
}

/**
 * Deterministic cloud layout for a given cover: same cover → same sky.
 * Banks sit on a ring above the village, flattened puffs clustered per bank.
 */
export function cloudPuffs(cloudCover: number, seed = 7): CloudPuff[] {
  const banks = Math.round(Math.min(1, Math.max(0, cloudCover)) * MAX_CLOUD_BANKS);
  const rand = mulberry32(seed);
  const puffs: CloudPuff[] = [];
  for (let b = 0; b < banks; b++) {
    const angle = (b / MAX_CLOUD_BANKS) * Math.PI * 2 + rand() * 0.3;
    const radius = 30 + rand() * 70;
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius;
    const cy = 30 + rand() * 14;
    const size = 6 + rand() * 6;
    for (let p = 0; p < PUFFS_PER_BANK; p++) {
      const s = size * (0.6 + rand() * 0.6);
      puffs.push({
        position: [cx + (rand() - 0.5) * size * 2.6, cy + rand() * 2, cz + (rand() - 0.5) * size],
        scale: [s * 1.4, s * 0.55, s],
      });
    }
  }
  return puffs;
}

/** Rain streak count for a density and quality tier. */
export function rainDropCount(rain: number, quality: 'high' | 'low'): number {
  const max = quality === 'high' ? 4000 : 1500;
  return Math.round(Math.min(1, Math.max(0, rain)) * max);
}

/**
 * Lightning brightness (0–1) at a time, from a fixed pseudo-random schedule:
 * a double flash roughly every 5–7 s. Pure, so the scene stays deterministic.
 */
export function lightningFlash(elapsedS: number): number {
  const period = 6.1;
  const cycle = Math.floor(elapsedS / period);
  const offset = mulberry32(cycle + 11)() * (period - 1);
  const t = elapsedS - cycle * period - offset;
  if (t < 0) return 0;
  if (t < 0.08) return 1;
  if (t < 0.16) return 0.15;
  if (t < 0.24) return 0.7;
  if (t < 0.5) return 0.7 * (1 - (t - 0.24) / 0.26);
  return 0;
}

/** Scene colors of the weather effects (3D materials, not UI tokens). */
export const WEATHER_HEX = {
  cloudLight: '#f2f0ec',
  cloudDark: '#3d424b',
  rainDay: '#c9d3de',
  rainNight: '#6f7c93',
  lightning: '#d6deff',
} as const;
