import 'server-only';

import {
  EPS,
  SECTOR_IDS,
  type SectorId,
  type SimulationInput,
  type SimulationResult,
} from '@mitsinjo/engine';
import {
  describeVillageScene,
  SECTOR_NOUNS,
  villageSceneCaption,
  type SkyLook,
} from '@/server/copilot/village-scene';

/**
 * Prompt templates for `generate_visual`, built from an engine result. The image model never sees
 * a number: states and time ranges go into the prompt as words, the exact hours ride in the
 * overlay for the HTML layer (M5-T3). Pure: no LLM, no storage.
 */

export type VisualKind = 'village_tonight' | 'shedding_poster' | 'day_comic';

export interface VisualCut {
  sector: SectorId;
  fromHour: number;
  toHour: number;
  unservedKwh: number;
}

export interface VisualPanel {
  hour: number;
  sky: SkyLook;
  /** Any connected sector short at that hour in the engine steps. */
  cuts: boolean;
}

export interface VisualOverlay {
  /** Cut windows per sector, from the engine steps (hours stay here, never in the prompt). */
  cuts: VisualCut[];
  /** Day-comic panels (M12-T3): fixed hours, engine states as words. */
  panels?: VisualPanel[];
}

export interface BuiltVisual {
  kind: VisualKind;
  /** English prompt for the image model. Never contains a digit. */
  prompt: string;
  overlay: VisualOverlay | null;
  caption: string;
}

/** Below this demand a sector is idle (school at night): not a cut. Mirrors the scene module. */
const IDLE_DEMAND_KW = 0.05;
/** The village illustration is always an evening view. */
const VILLAGE_TONIGHT_HOUR = 20;

const round2 = (n: number) => Math.round(n * 100) / 100;

function dayPart(hour: number): string {
  if (hour < 5 || hour >= 20) return 'at night';
  if (hour < 8) return 'in the early morning';
  if (hour < 12) return 'in the morning';
  if (hour < 17) return 'in the afternoon';
  return 'in the evening';
}

/**
 * Contiguous hours where the sector wanted power and got less, merged per sector. A shortfall at
 * or below FP noise is not a cut.
 */
export function cutWindows(result: SimulationResult): VisualCut[] {
  const cuts: VisualCut[] = [];
  for (const sector of SECTOR_IDS) {
    let open: { fromHour: number; unservedKwh: number } | null = null;
    const close = (toHour: number) => {
      if (open && open.unservedKwh > 0) {
        cuts.push({
          sector,
          fromHour: open.fromHour,
          toHour,
          unservedKwh: round2(open.unservedKwh),
        });
      }
      open = null;
    };
    for (const step of result.steps) {
      const s = step.sectors[sector];
      const shortfall = s ? s.demandKw - s.servedKw : 0;
      if (s && s.demandKw > IDLE_DEMAND_KW && shortfall > EPS) {
        if (!open) open = { fromHour: step.t, unservedKwh: 0 };
        open.unservedKwh += shortfall;
      } else {
        if (open) close(step.t);
      }
    }
    if (open) close(24);
  }
  return cuts;
}

/** Comic panels: fixed hours with their day-part words (never digits in the prompt). */
const COMIC_PANELS: { hour: number; word: string }[] = [
  { hour: 7, word: 'morning' },
  { hour: 12, word: 'midday' },
  { hour: 17, word: 'afternoon' },
  { hour: 21, word: 'evening' },
];
const PANEL_ORDERS = ['First', 'Second', 'Third', 'Fourth'] as const;

/** True when some sector wants power and gets less at that hour. */
function hourHasCuts(result: SimulationResult, hour: number): boolean {
  const step = result.steps[hour];
  if (!step) return false;
  return Object.values(step.sectors).some(
    (s) => s.demandKw > IDLE_DEMAND_KW && s.demandKw - s.servedKw > EPS
  );
}

function posterCaption(kind: VisualKind, cuts: VisualCut[], locale: 'en' | 'fr' | 'mg'): string {
  if (kind === 'village_tonight') {
    return (
      {
        en: 'The village this evening, from the simulated state',
        fr: 'Le village ce soir, depuis l’état simulé',
        mg: 'Ny tanàna anio alina, araka ny toetra voakajy',
      } as const
    )[locale];
  }
  if (kind === 'day_comic') {
    return (
      {
        en: 'The day in four panels, from the simulated states',
        fr: 'La journée en quatre cases, depuis les états simulés',
        mg: 'Ny andro amin’ny sary efatra, araka ny toetra voakajy',
      } as const
    )[locale];
  }
  if (cuts.length === 0) {
    return (
      {
        en: 'No cut to announce: every sector is powered',
        fr: 'Aucune coupure à annoncer : tous les secteurs sont alimentés',
        mg: 'Tsy misy fahatapahana: mandeha ny sehatra rehetra',
      } as const
    )[locale];
  }
  return (
    {
      en: 'Load-shedding poster background — cut hours in the overlay, from the engine',
      fr: 'Fond d’affiche de délestage — horaires de coupure en surcouche, depuis le moteur',
      mg: 'Sarin’ny peta-drindrina — ora fahatapahana eo ambony, avy amin’ny motera',
    } as const
  )[locale];
}

export function buildVisualPrompt(
  kind: VisualKind,
  input: SimulationInput,
  result: SimulationResult,
  locale: 'en' | 'fr' | 'mg' = 'en'
): BuiltVisual {
  if (kind === 'village_tonight') {
    const scene = describeVillageScene(input, result, VILLAGE_TONIGHT_HOUR);
    return {
      kind,
      prompt: scene.prompt,
      overlay: null,
      caption: villageSceneCaption(scene, locale),
    };
  }

  if (kind === 'day_comic') {
    const panels = COMIC_PANELS.map(({ hour }) => {
      const scene = describeVillageScene(input, result, hour);
      return { hour, sky: scene.sky, cuts: hourHasCuts(result, hour), blurb: scene.prompt };
    });
    const panelText = panels
      .map((p, i) => `${PANEL_ORDERS[i]} panel (${COMIC_PANELS[i]?.word}): ${p.blurb}`)
      .join(' ');
    return {
      kind,
      prompt:
        'Four-panel comic strip, same small rural village in Madagascar with a solar microgrid, ' +
        'same characters across panels, warm illustration style. ' +
        `${panelText} No text, no numbers, no labels, no speech bubbles with words.`,
      overlay: {
        cuts: [],
        panels: panels.map(({ hour, sky, cuts }) => ({ hour, sky, cuts })),
      },
      caption: posterCaption(kind, [], locale),
    };
  }

  const cuts = cutWindows(result);
  const cutSectors = [...new Set(cuts.map((c) => c.sector))];
  const when =
    cuts.length === 0 ? 'in the evening' : dayPart(Math.min(...cuts.map((c) => c.fromHour)));
  const darkText =
    cutSectors.length === 0
      ? 'every building lit and working'
      : `${cutSectors.map((s) => SECTOR_NOUNS[s]).join(', ')} dark without power, other buildings lit`;
  return {
    kind,
    prompt:
      'Poster background, no text: a small rural village in Madagascar with a solar microgrid, ' +
      `${when}. Solar panels on a field next to the houses, ${darkText}. ` +
      'Warm illustration style, clear contrast between powered and unpowered buildings. ' +
      'No text, no numbers, no labels.',
    overlay: { cuts },
    caption: posterCaption(kind, cuts, locale),
  };
}
