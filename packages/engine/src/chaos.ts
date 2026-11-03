import { WEATHER_IDS, WorkflowSchema } from './schemas/workflow';
import { ScenarioEventSchema } from './schemas/input';
import type { ScenarioEvent, SectorId, WeatherId, Workflow } from './schemas';

/**
 * Deterministic 32-bit PRNG (Mulberry32).
 * Pure TS, zero Math.random, 100% reproducible across all platforms.
 */
export function createPrng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ChaosOptions {
  /** Deterministic integer seed. */
  seed: number;
  /** Number of days in the generated workflow (1 to 7, default 3). */
  days?: number;
  /** Fixed weathers per day, or omitted to randomize from WEATHER_IDS. */
  weathers?: readonly WeatherId[];
  /** Maximum scripted incidents per day (default 1, max 2). */
  maxIncidentsPerDay?: number;
}

const CHAOS_SECTORS: readonly SectorId[] = ['market', 'water', 'school', 'households', 'industry'];

/**
 * Generates a deterministic chaos workflow with seeded incidents (PA-T6c):
 * - Weather changes per day (cloudy, sunny, storm, rainy)
 * - Seeded incidents: fires, demand surges, solar drops
 * - Strictly satisfies WorkflowSchema and ScenarioEvent bounds
 */
export function generateChaosWorkflow(options: ChaosOptions): Workflow {
  const seed = options.seed >>> 0;
  const rand = createPrng(seed);
  const daysCount = Math.min(7, Math.max(1, options.days ?? 3));
  const maxIncidents = Math.min(2, Math.max(0, options.maxIncidentsPerDay ?? 1));

  const workflow: Workflow = [];

  for (let day = 0; day < daysCount; day++) {
    // 1. Pick weather
    let weather: WeatherId;
    if (options.weathers && options.weathers[day]) {
      weather = options.weathers[day]!;
    } else {
      const wIdx = Math.floor(rand() * WEATHER_IDS.length);
      weather = WEATHER_IDS[wIdx]!;
    }

    // 2. Pick incidents
    const dayEvents: ScenarioEvent[] = [];
    const eventCount = Math.floor(rand() * (maxIncidents + 1)); // 0..maxIncidents

    for (let e = 0; e < eventCount; e++) {
      const typeRoll = rand();
      if (typeRoll < 0.35) {
        // Fire event
        const secIdx = Math.floor(rand() * CHAOS_SECTORS.length);
        const sector = CHAOS_SECTORS[secIdx]!;
        const startHour = 10 + Math.floor(rand() * 7); // 10..16
        const maxDuration = 24 - startHour;
        const durationH = Math.min(maxDuration, 3 + Math.floor(rand() * 5)); // 3..7 h
        dayEvents.push(
          ScenarioEventSchema.parse({
            type: 'fire',
            sector,
            startHour,
            durationH,
          })
        );
      } else if (typeRoll < 0.7) {
        // Demand spike event
        const isAll = rand() < 0.3;
        const secIdx = Math.floor(rand() * CHAOS_SECTORS.length);
        const sector: SectorId | 'all' = isAll ? 'all' : CHAOS_SECTORS[secIdx]!;
        const startHour = 17 + Math.floor(rand() * 4); // 17..20
        const maxDuration = 24 - startHour;
        const durationH = Math.min(maxDuration, 2 + Math.floor(rand() * 4)); // 2..5 h
        const factor = Math.round((1.3 + rand() * 0.5) * 10) / 10; // 1.3..1.8
        dayEvents.push(
          ScenarioEventSchema.parse({
            type: 'demand_spike',
            sector,
            startHour,
            durationH,
            factor,
          })
        );
      } else {
        // Solar drop event
        const startHour = 10 + Math.floor(rand() * 4); // 10..13
        const maxDuration = 24 - startHour;
        const durationH = Math.min(maxDuration, 2 + Math.floor(rand() * 4)); // 2..5 h
        const factor = Math.round((0.2 + rand() * 0.4) * 10) / 10; // 0.2..0.6
        dayEvents.push(
          ScenarioEventSchema.parse({
            type: 'solar_drop',
            startHour,
            durationH,
            factor,
          })
        );
      }
    }

    workflow.push({
      weather,
      ...(dayEvents.length > 0 ? { events: dayEvents } : {}),
    });
  }

  return WorkflowSchema.parse(workflow);
}
