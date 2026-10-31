import 'server-only';

import {
  isSectorConnected,
  SECTOR_IDS,
  type SectorId,
  type SimulationInput,
  type SimulationResult,
} from '@mitsinjo/engine';

/**
 * Turns the engine result at one hour into words for an image prompt. No number reaches the prompt:
 * the picture shows states (lit, dim, dark, cloudy, battery level), the numbers stay in the engine.
 */

export type SectorLook = 'lit' | 'dim' | 'dark' | 'closed';
export type SkyLook = 'night' | 'sunny' | 'partly_cloudy' | 'overcast';
export type BatteryLook = 'full' | 'half' | 'low' | 'empty';

export interface VillageScene {
  hour: number;
  sky: SkyLook;
  battery: BatteryLook;
  /** Connected sectors only. */
  sectors: Partial<Record<SectorId, SectorLook>>;
  /** English prompt for the image model, without numbers. */
  prompt: string;
}

/** Below this demand a sector has nothing to power (school at night): shown closed, not cut. */
const IDLE_DEMAND_KW = 0.05;
/** Solar profile weight under which the hour counts as night. */
const NIGHT_PROFILE = 0.05;

const NOUNS: Record<SectorId, string> = {
  health: 'the small health clinic',
  water: 'the water pump and water tower',
  school: 'the school',
  households: 'the houses',
  market: 'the market stalls',
  industry: 'the small workshop',
};

const LOOK_TEXT: Record<SectorLook, { day: string; night: string }> = {
  lit: { day: 'powered and working', night: 'powered, windows and lamps lit' },
  dim: {
    day: 'on minimal power, mostly idle',
    night: 'on minimal power, only one dim light',
  },
  dark: { day: 'without power, idle', night: 'without power, completely dark' },
  closed: { day: 'closed for now', night: 'closed, lights off' },
};

const SKY_TEXT: Record<SkyLook, string> = {
  night: 'at night under a starry sky',
  sunny: 'in bright sunshine',
  partly_cloudy: 'under a partly cloudy sky',
  overcast: 'under heavy dark clouds',
};

const BATTERY_TEXT: Record<BatteryLook, string> = {
  full: 'the battery cabinet shows a full green indicator',
  half: 'the battery cabinet shows a half-full amber indicator',
  low: 'the battery cabinet shows a low orange indicator',
  empty: 'the battery cabinet shows an empty red indicator',
};

function timeOfDay(hour: number): string {
  if (hour < 5 || hour >= 20) return 'late evening';
  if (hour < 8) return 'early morning';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'dusk';
}

export function describeVillageScene(
  input: SimulationInput,
  result: SimulationResult,
  hour: number
): VillageScene {
  const h = Math.min(23, Math.max(0, Math.round(hour)));
  const step = result.steps[h]!;

  const profile = input.solar.profile[h] ?? 0;
  const clearSkyKw = input.solar.peakKw * profile;
  let sky: SkyLook = 'night';
  if (profile >= NIGHT_PROFILE && clearSkyKw > 0) {
    const ratio = step.solarKw / clearSkyKw;
    sky = ratio < 0.5 ? 'overcast' : ratio < 0.85 ? 'partly_cloudy' : 'sunny';
  }

  const soc = step.socPct;
  const battery: BatteryLook =
    soc >= 80 ? 'full' : soc >= 40 ? 'half' : soc > input.battery.minSocPct + 5 ? 'low' : 'empty';

  const sectors: Partial<Record<SectorId, SectorLook>> = {};
  for (const id of SECTOR_IDS) {
    const config = input.sectors.find((c) => c.id === id);
    if (!config || !isSectorConnected(config)) continue;
    const s = step.sectors[id];
    if (!s || s.demandKw < IDLE_DEMAND_KW) {
      sectors[id] = 'closed';
    } else if (s.mode === 'off') {
      sectors[id] = 'dark';
    } else if (s.mode === 'full') {
      sectors[id] = 'lit';
    } else {
      sectors[id] = 'dim';
    }
  }

  const night = sky === 'night';
  const sectorText = (Object.entries(sectors) as Array<[SectorId, SectorLook]>)
    .map(([id, look]) => `${NOUNS[id]} ${night ? LOOK_TEXT[look].night : LOOK_TEXT[look].day}`)
    .join('; ');

  const prompt =
    `Wide illustration of a small rural village in Madagascar with a solar microgrid, ${timeOfDay(h)}, ` +
    `${SKY_TEXT[sky]}. Solar panels on a field, ${BATTERY_TEXT[battery]}. ${sectorText}. ` +
    'Clear contrast between powered and unpowered buildings. No text, no numbers, no labels.';

  return { hour: h, sky, battery, sectors, prompt };
}

const LOOK_LABEL: Record<'en' | 'fr', Record<SectorLook, string>> = {
  en: { lit: 'powered', dim: 'minimal power', dark: 'cut', closed: 'closed' },
  fr: { lit: 'alimenté', dim: 'courant minimal', dark: 'coupé', closed: 'fermé' },
};

const SECTOR_LABEL: Record<'en' | 'fr', Record<SectorId, string>> = {
  en: {
    health: 'clinic',
    water: 'water',
    school: 'school',
    households: 'houses',
    market: 'market',
    industry: 'workshop',
  },
  fr: {
    health: 'clinique',
    water: 'eau',
    school: 'école',
    households: 'foyers',
    market: 'marché',
    industry: 'atelier',
  },
};

/** Caption under the picture: the hour and each sector's state, from the engine (no energy value). */
export function villageSceneCaption(scene: VillageScene, locale: 'en' | 'fr' | 'mg'): string {
  const lang = locale === 'fr' ? 'fr' : 'en';
  const parts = (Object.entries(scene.sectors) as Array<[SectorId, SectorLook]>).map(
    ([id, look]) =>
      `${SECTOR_LABEL[lang][id]}${lang === 'fr' ? ' : ' : ': '}${LOOK_LABEL[lang][look]}`
  );
  const head =
    lang === 'fr'
      ? `Illustration IA du village simulé à ${scene.hour} h`
      : `AI illustration of the simulated village at ${scene.hour}:00`;
  return `${head} — ${parts.join(' · ')}`;
}
