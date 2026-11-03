import { z } from 'zod';
import {
  type WeatherId,
  type SectorId,
  type StrategyId,
  type DispatchMode,
  type ScenarioEvent,
  type WorkflowDay,
  WeatherIdSchema,
  SectorIdSchema,
  StrategyIdSchema,
  DispatchModeSchema,
  MAX_WORKFLOW_DAYS,
} from '@mitsinjo/engine';

export type { WeatherId, SectorId };

/**
 * Multi-day scenario drafting schemas and helpers (PA-T8b).
 * Allows partial inputs while the user describes or refines a scenario via chat.
 */

export const ScenarioDraftFireEventSchema = z.object({
  type: z.literal('fire'),
  sector: SectorIdSchema.optional(),
  startHour: z.number().int().min(0).max(23).optional(),
  durationH: z.number().int().min(1).max(24).optional(),
});
export type ScenarioDraftFireEvent = z.infer<typeof ScenarioDraftFireEventSchema>;

export const ScenarioDraftSolarDropEventSchema = z.object({
  type: z.literal('solar_drop'),
  dropPct: z.number().min(0).max(90).optional(),
  startHour: z.number().int().min(0).max(23).optional(),
  durationH: z.number().int().min(1).max(24).optional(),
});
export type ScenarioDraftSolarDropEvent = z.infer<typeof ScenarioDraftSolarDropEventSchema>;

export const ScenarioDraftDemandSpikeEventSchema = z.object({
  type: z.literal('demand_spike'),
  sector: z.union([SectorIdSchema, z.literal('all')]).optional(),
  factor: z.number().min(0.5).max(3).optional(),
  startHour: z.number().int().min(0).max(23).optional(),
  durationH: z.number().int().min(1).max(24).optional(),
});
export type ScenarioDraftDemandSpikeEvent = z.infer<typeof ScenarioDraftDemandSpikeEventSchema>;

export const ScenarioDraftEventSchema = z.discriminatedUnion('type', [
  ScenarioDraftFireEventSchema,
  ScenarioDraftSolarDropEventSchema,
  ScenarioDraftDemandSpikeEventSchema,
]);
export type ScenarioDraftEvent = z.infer<typeof ScenarioDraftEventSchema>;

export const ScenarioDraftDaySchema = z.object({
  day: z.number().int(),
  weather: WeatherIdSchema.optional(),
  events: z.array(ScenarioDraftEventSchema).optional(),
});
export type ScenarioDraftDay = z.infer<typeof ScenarioDraftDaySchema>;

export const ScenarioDraftSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  days: z.array(ScenarioDraftDaySchema).min(1).max(MAX_WORKFLOW_DAYS),
  startSocPct: z.number().min(0).max(100).optional(),
  strategy: StrategyIdSchema.optional(),
  dispatchMode: DispatchModeSchema.optional(),
});
export type ScenarioDraft = z.infer<typeof ScenarioDraftSchema>;

export type MissingSlotKind =
  | 'day_out_of_bounds'
  | 'duplicate_weather'
  | 'missing_weather'
  | 'missing_fire_hour'
  | 'missing_fire_sector'
  | 'missing_spike_factor'
  | 'missing_spike_sector'
  | 'missing_drop_pct'
  | 'missing_drop_hour';

export interface MissingSlotOption {
  label: string;
  value: string | number;
}

export interface MissingSlot {
  kind: MissingSlotKind;
  day: number;
  eventIndex?: number;
  messageKey: string;
  suggestedResponses: MissingSlotOption[];
}

export interface ScenarioDraftPreview {
  worstDay: number;
  totalDeficitKwh: number;
  criticalUnservedKwh: number;
  dayDeficits: Array<{ day: number; deficitKwh: number }>;
}

export interface ScenarioDraftPayload {
  draft: ScenarioDraft;
  missingSlots: MissingSlot[];
  isComplete: boolean;
  preview?: ScenarioDraftPreview;
}

/** Default simulation values when missing from a draft (PA-T8b spec). */
export const DRAFT_DEFAULTS = {
  startSocPct: 60,
  strategy: 'proportional' as StrategyId,
  dispatchMode: 'manual' as DispatchMode,
  weather: 'sunny' as WeatherId,
  fireStartHour: 12,
  spikeFactor: 1.5,
  spikeStartHour: 18,
  spikeDurationH: 4,
  dropPct: 50,
  dropStartHour: 10,
  dropDurationH: 6,
} as const;

/**
 * Pure function returning ordered missing information in a ScenarioDraft.
 * Checks:
 * - Days out of bounds (> 7 or < 1)
 * - Contradictions / duplicate days with conflicting weather
 * - Missing weather on any day
 * - Partial events lacking critical parameters (fire hour/sector, spike factor/sector, drop pct/hour)
 *
 * Targets:
 * - Target example: Day 1 cloudy, Day 2 rainy, Day 3 sunny + fire at school -> exactly 1 missing slot (missing_fire_hour).
 * - Completed draft -> 0 missing slots.
 */
export function missingSlots(draft: ScenarioDraft): MissingSlot[] {
  const slots: MissingSlot[] = [];
  const seenDays = new Set<number>();

  for (let dayIdx = 0; dayIdx < draft.days.length; dayIdx++) {
    const d = draft.days[dayIdx]!;

    // Check bounds
    if (d.day < 1 || d.day > MAX_WORKFLOW_DAYS) {
      slots.push({
        kind: 'day_out_of_bounds',
        day: d.day,
        messageKey: 'dayOutOfBounds',
        suggestedResponses: [
          { label: 'Day 1', value: 1 },
          { label: 'Day 2', value: 2 },
          { label: 'Day 3', value: 3 },
        ],
      });
      continue;
    }

    // Check duplicate days
    if (seenDays.has(d.day)) {
      slots.push({
        kind: 'duplicate_weather',
        day: d.day,
        messageKey: 'duplicateWeather',
        suggestedResponses: [
          { label: 'Sunny', value: 'sunny' },
          { label: 'Cloudy', value: 'cloudy' },
          { label: 'Rainy', value: 'rainy' },
        ],
      });
    }
    seenDays.add(d.day);

    // Missing weather
    if (!d.weather) {
      slots.push({
        kind: 'missing_weather',
        day: d.day,
        messageKey: 'missingWeather',
        suggestedResponses: [
          { label: 'Sunny', value: 'sunny' },
          { label: 'Cloudy', value: 'cloudy' },
          { label: 'Rainy', value: 'rainy' },
          { label: 'Storm', value: 'storm' },
        ],
      });
    }

    // Inspect events on this day
    if (d.events && d.events.length > 0) {
      for (let eIdx = 0; eIdx < d.events.length; eIdx++) {
        const ev = d.events[eIdx]!;
        if (ev.type === 'fire') {
          if (!ev.sector) {
            slots.push({
              kind: 'missing_fire_sector',
              day: d.day,
              eventIndex: eIdx,
              messageKey: 'missingFireSector',
              suggestedResponses: [
                { label: 'School', value: 'school' },
                { label: 'Market', value: 'market' },
                { label: 'Health', value: 'health' },
                { label: 'Water', value: 'water' },
                { label: 'Households', value: 'households' },
                { label: 'Industry', value: 'industry' },
              ],
            });
          }
          if (ev.startHour === undefined) {
            slots.push({
              kind: 'missing_fire_hour',
              day: d.day,
              eventIndex: eIdx,
              messageKey: 'missingFireHour',
              suggestedResponses: [
                { label: '08:00', value: 8 },
                { label: '12:00', value: 12 },
                { label: '14:00', value: 14 },
                { label: '16:00', value: 16 },
              ],
            });
          }
        } else if (ev.type === 'demand_spike') {
          if (!ev.sector) {
            slots.push({
              kind: 'missing_spike_sector',
              day: d.day,
              eventIndex: eIdx,
              messageKey: 'missingSpikeSector',
              suggestedResponses: [
                { label: 'Households', value: 'households' },
                { label: 'Industry', value: 'industry' },
                { label: 'Market', value: 'market' },
                { label: 'All', value: 'all' },
              ],
            });
          }
          if (ev.factor === undefined) {
            slots.push({
              kind: 'missing_spike_factor',
              day: d.day,
              eventIndex: eIdx,
              messageKey: 'missingSpikeFactor',
              suggestedResponses: [
                { label: '×1.3 (+30%)', value: 1.3 },
                { label: '×1.5 (+50%)', value: 1.5 },
                { label: '×2.0 (+100%)', value: 2.0 },
              ],
            });
          }
        } else if (ev.type === 'solar_drop') {
          if (ev.dropPct === undefined) {
            slots.push({
              kind: 'missing_drop_pct',
              day: d.day,
              eventIndex: eIdx,
              messageKey: 'missingDropPct',
              suggestedResponses: [
                { label: '-30%', value: 30 },
                { label: '-50%', value: 50 },
                { label: '-70%', value: 70 },
              ],
            });
          }
          if (ev.startHour === undefined) {
            slots.push({
              kind: 'missing_drop_hour',
              day: d.day,
              eventIndex: eIdx,
              messageKey: 'missingDropHour',
              suggestedResponses: [
                { label: '09:00', value: 9 },
                { label: '11:00', value: 11 },
                { label: '13:00', value: 13 },
              ],
            });
          }
        }
      }
    }
  }

  return slots;
}

/**
 * Completes a draft by applying default values for unspecified secondary properties.
 * In accordance with PA-T8b:
 * - Fire runs until midnight (durationH = 24 - startHour)
 * - Battery start SoC = 60%
 * - Strategy = proportional
 * - DispatchMode = manual (or autonomous if previously set)
 */
export function applyDraftDefaults(draft: ScenarioDraft): ScenarioDraft {
  const completedDays = draft.days.map((d) => {
    const weather = d.weather ?? DRAFT_DEFAULTS.weather;
    const events: ScenarioDraftEvent[] = (d.events ?? []).map((ev) => {
      if (ev.type === 'fire') {
        const startHour = ev.startHour ?? DRAFT_DEFAULTS.fireStartHour;
        const durationH = ev.durationH ?? Math.max(1, 24 - startHour);
        return {
          ...ev,
          sector: ev.sector ?? 'school',
          startHour,
          durationH,
        };
      }
      if (ev.type === 'demand_spike') {
        const startHour = ev.startHour ?? DRAFT_DEFAULTS.spikeStartHour;
        const durationH = ev.durationH ?? Math.min(DRAFT_DEFAULTS.spikeDurationH, 24 - startHour);
        return {
          ...ev,
          sector: ev.sector ?? 'households',
          factor: ev.factor ?? DRAFT_DEFAULTS.spikeFactor,
          startHour,
          durationH,
        };
      }
      if (ev.type === 'solar_drop') {
        const startHour = ev.startHour ?? DRAFT_DEFAULTS.dropStartHour;
        const durationH = ev.durationH ?? Math.min(DRAFT_DEFAULTS.dropDurationH, 24 - startHour);
        return {
          ...ev,
          dropPct: ev.dropPct ?? DRAFT_DEFAULTS.dropPct,
          startHour,
          durationH,
        };
      }
      return ev;
    });

    return {
      day: d.day,
      weather,
      events,
    };
  });

  return {
    ...draft,
    title: draft.title || `Scenario (${draft.days.length} days)`,
    days: completedDays,
    startSocPct: draft.startSocPct ?? DRAFT_DEFAULTS.startSocPct,
    strategy: draft.strategy ?? DRAFT_DEFAULTS.strategy,
    dispatchMode: draft.dispatchMode ?? DRAFT_DEFAULTS.dispatchMode,
  };
}

/**
 * Converts a valid or defaulted ScenarioDraft into engine WorkflowDay[] with per-day events.
 */
export function draftToWorkflow(draft: ScenarioDraft): {
  workflow: WorkflowDay[];
  startSocPct: number;
  strategy: StrategyId;
  dispatchMode: DispatchMode;
} {
  const filled = applyDraftDefaults(draft);
  const sortedDays = [...filled.days].sort((a, b) => a.day - b.day);

  const workflow: WorkflowDay[] = sortedDays.map((d) => {
    const validEvents: ScenarioEvent[] = [];
    for (const ev of d.events ?? []) {
      if (ev.type === 'fire' && ev.sector && ev.startHour !== undefined) {
        const durationH = Math.min(ev.durationH ?? 24 - ev.startHour, 24 - ev.startHour);
        validEvents.push({
          type: 'fire',
          sector: ev.sector,
          startHour: ev.startHour,
          durationH: Math.max(1, durationH),
        });
      } else if (ev.type === 'demand_spike' && ev.sector && ev.factor !== undefined) {
        const startHour = ev.startHour ?? 18;
        const durationH = Math.min(ev.durationH ?? 4, 24 - startHour);
        validEvents.push({
          type: 'demand_spike',
          sector: ev.sector,
          factor: ev.factor,
          startHour,
          durationH: Math.max(1, durationH),
        });
      } else if (ev.type === 'solar_drop' && ev.dropPct !== undefined) {
        const startHour = ev.startHour ?? 10;
        const durationH = Math.min(ev.durationH ?? 6, 24 - startHour);
        validEvents.push({
          type: 'solar_drop',
          factor: Math.max(0, 1 - ev.dropPct / 100),
          startHour,
          durationH: Math.max(1, durationH),
        });
      }
    }

    return {
      weather: d.weather ?? 'sunny',
      ...(validEvents.length > 0 ? { events: validEvents } : {}),
    };
  });

  return {
    workflow,
    startSocPct: filled.startSocPct ?? 60,
    strategy: filled.strategy ?? 'proportional',
    dispatchMode: filled.dispatchMode ?? 'manual',
  };
}

/**
 * Applies one missing-slot answer (a suggestion pill) to the draft, structurally.
 * Pure: returns a new draft; unknown or mismatched values leave the draft unchanged.
 */
export function applySlotAnswer(
  draft: ScenarioDraft,
  slot: MissingSlot,
  value: string | number
): ScenarioDraft {
  if (slot.kind === 'day_out_of_bounds') {
    const day = Number(value);
    if (!Number.isInteger(day) || day < 1 || day > MAX_WORKFLOW_DAYS) return draft;
    return {
      ...draft,
      days: draft.days.map((d) => (d.day === slot.day ? { ...d, day } : d)),
    };
  }

  if (slot.kind === 'missing_weather' || slot.kind === 'duplicate_weather') {
    const weather = WeatherIdSchema.safeParse(value);
    if (!weather.success) return draft;
    if (slot.kind === 'duplicate_weather') {
      // Keep the first entry of that day with the chosen weather; merge the duplicates' events.
      const same = draft.days.filter((d) => d.day === slot.day);
      const merged: ScenarioDraftDay = {
        day: slot.day,
        weather: weather.data,
        events: same.flatMap((d) => d.events ?? []),
      };
      const firstIdx = draft.days.findIndex((d) => d.day === slot.day);
      return {
        ...draft,
        days: draft.days
          .map((d, i) => (i === firstIdx ? merged : d))
          .filter((d, i) => i === firstIdx || d.day !== slot.day),
      };
    }
    return {
      ...draft,
      days: draft.days.map((d) => (d.day === slot.day ? { ...d, weather: weather.data } : d)),
    };
  }

  const patchEvent = (patch: (ev: ScenarioDraftEvent) => ScenarioDraftEvent | null) => {
    let changed = false;
    const days = draft.days.map((d) => {
      if (d.day !== slot.day || slot.eventIndex === undefined || !d.events?.[slot.eventIndex]) {
        return d;
      }
      const next = patch(d.events[slot.eventIndex]!);
      if (!next) return d;
      changed = true;
      return { ...d, events: d.events.map((ev, i) => (i === slot.eventIndex ? next : ev)) };
    });
    return changed ? { ...draft, days } : draft;
  };

  const hour = Number(value);
  const validHour = Number.isInteger(hour) && hour >= 0 && hour <= 23;
  const num = Number(value);

  switch (slot.kind) {
    case 'missing_fire_hour':
      return patchEvent((ev) =>
        ev.type === 'fire' && validHour ? { ...ev, startHour: hour } : null
      );
    case 'missing_drop_hour':
      return patchEvent((ev) =>
        ev.type === 'solar_drop' && validHour ? { ...ev, startHour: hour } : null
      );
    case 'missing_fire_sector': {
      const sector = SectorIdSchema.safeParse(value);
      return patchEvent((ev) =>
        ev.type === 'fire' && sector.success ? { ...ev, sector: sector.data } : null
      );
    }
    case 'missing_spike_sector': {
      const sector = z.union([SectorIdSchema, z.literal('all')]).safeParse(value);
      return patchEvent((ev) =>
        ev.type === 'demand_spike' && sector.success ? { ...ev, sector: sector.data } : null
      );
    }
    case 'missing_spike_factor':
      return patchEvent((ev) =>
        ev.type === 'demand_spike' && Number.isFinite(num) && num >= 0.5 && num <= 3
          ? { ...ev, factor: num }
          : null
      );
    case 'missing_drop_pct':
      return patchEvent((ev) =>
        ev.type === 'solar_drop' && Number.isFinite(num) && num >= 0 && num <= 90
          ? { ...ev, dropPct: num }
          : null
      );
    default:
      return draft;
  }
}
