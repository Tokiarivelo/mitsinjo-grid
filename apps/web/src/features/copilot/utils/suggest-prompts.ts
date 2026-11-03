import {
  fireEvents,
  type SectorId,
  type SimulationInput,
  type SimulationResult,
  type StrategyId,
  type DispatchLogEntry,
} from '@mitsinjo/engine';
import type { ScenarioDraftPayload } from '../types';

export interface SuggestedPromptItem {
  key: string;
  params?: Record<string, string | number>;
  /** `incident`: about a fire burning now (flame icon, red border). */
  tone?: 'incident';
}

export interface SuggestPromptsOptions {
  result?: SimulationResult | null;
  activeStrategy?: StrategyId;
  scenarioId?: string;
  /** Input of the run: its fires and events give scenario-specific questions. */
  input?: Pick<SimulationInput, 'events'>;
  /** Sectors on fire at the shown hour (M2): their questions come first. */
  fires?: readonly SectorId[];
  /** Autonomous dispatch event log (PA-T5b). */
  dispatchLog?: readonly DispatchLogEntry[];
  /** Active multi-day scenario draft (PA-T8g). */
  scenarioDraft?: ScenarioDraftPayload;
}

/** Questions about a fire, in order. Worded without "cut" so the offline copilot never reads a new order. */
export const FIRE_PROMPT_KEYS = [
  'promptFireImpact',
  'promptFireEssential',
  'promptFireEnergy',
  'promptFireRestore',
] as const;

/** Prompts for the fires burning now: all four for the first sector, the impact question for the others. */
function firePrompts(fires: readonly SectorId[]): SuggestedPromptItem[] {
  const [first, ...others] = fires;
  if (!first) return [];
  return [
    ...FIRE_PROMPT_KEYS.map((key) => ({
      key,
      params: { sector: first },
      tone: 'incident' as const,
    })),
    ...others.map((sector) => ({
      key: 'promptFireImpact',
      params: { sector },
      tone: 'incident' as const,
    })),
  ];
}

/** Most prompts shown at once. */
export const MAX_PROMPTS = 6;

/** Below this many result-driven questions, a calm day also gets its "what if" questions. */
const MIN_RESULT_PROMPTS = 4;

/** Fires written in the scenario that do not burn at the shown hour (e.g. `village_fire` before 14 h). */
function scriptedFirePrompts(
  input: Pick<SimulationInput, 'events'> | undefined,
  burning: readonly SectorId[]
): SuggestedPromptItem[] {
  if (!input) return [];
  return fireEvents(input.events)
    .filter((f) => !burning.includes(f.sector))
    .map((f) => ({
      key: 'promptFireScripted',
      params: { sector: f.sector, hour: f.startHour },
      tone: 'incident' as const,
    }));
}

/** One question per weather or demand event of the scenario, worded with its own numbers. */
function eventPrompts(input: Pick<SimulationInput, 'events'> | undefined): SuggestedPromptItem[] {
  if (!input) return [];
  const out: SuggestedPromptItem[] = [];
  for (const e of input.events) {
    const range = { from: e.startHour, to: e.startHour + e.durationH };
    if (e.type === 'solar_drop') {
      out.push({
        key: 'promptSolarDropEvent',
        params: { pct: Math.round((1 - e.factor) * 100), ...range },
      });
    } else if (e.type === 'demand_spike') {
      out.push({
        key: 'promptDemandSpikeEvent',
        params: { pct: Math.round((e.factor - 1) * 100), ...range },
      });
    }
  }
  return out;
}

/** Questions generated from autonomous dispatch events (PA-T5b). */
function dispatchPrompts(dispatchLog?: readonly DispatchLogEntry[]): SuggestedPromptItem[] {
  if (!dispatchLog || dispatchLog.length === 0) return [];
  const prompts: SuggestedPromptItem[] = [];

  const actions = dispatchLog.filter((e) => e.action !== undefined);
  const latestAction = actions[actions.length - 1];
  if (latestAction?.action) {
    const sec = latestAction.action.sector ?? latestAction.incident?.sector;
    prompts.push({
      key: sec ? 'promptWhyDispatchAction' : 'promptWhyDispatchActionNoSector',
      params: {
        hour: latestAction.hour,
        action: latestAction.action.kind,
        ...(sec ? { sector: sec } : {}),
      },
      tone: 'incident',
    });
  }

  if (actions.length > 1) {
    prompts.push({
      key: 'promptDispatchSummary',
    });
  }

  return prompts;
}

/**
 * Questions generated from the simulation the operator ran (P6-T10): its fires, events, deficits,
 * warnings and battery, at most 6. No result and no fire burning → empty: the UI asks to run a
 * simulation first instead of showing a fixed list.
 */
export function suggestPrompts(options?: SuggestPromptsOptions): SuggestedPromptItem[] {
  const result = options?.result;
  const activeStrategy = options?.activeStrategy ?? 'proportional';
  const fires = options?.fires ?? [];

  const dynamic: SuggestedPromptItem[] = [];
  const addedKeys = new Set<string>();

  const pushPrompt = (item: SuggestedPromptItem) => {
    const id = `${item.key}:${item.params?.sector ?? ''}:${item.params?.hour ?? ''}`;
    if (!addedKeys.has(id) && dynamic.length < MAX_PROMPTS) {
      addedKeys.add(id);
      dynamic.push(item);
    }
  };

  // 0. A fire burns now (M2): the incident comes first, even before a run.
  firePrompts(fires).forEach(pushPrompt);

  // 0b. Autonomous dispatch events (PA-T5b)
  dispatchPrompts(options?.dispatchLog).forEach(pushPrompt);

  // 0c. Multi-day scenario draft in progress (PA-T8g)
  if (options?.scenarioDraft && options.scenarioDraft.missingSlots.length > 0) {
    const slot = options.scenarioDraft.missingSlots[0]!;
    for (const opt of slot.suggestedResponses.slice(0, 3)) {
      pushPrompt({
        key: 'promptAnswerDraftSlot',
        params: { day: slot.day, value: String(opt.value), label: opt.label },
      });
    }
  }

  if (!result || !result.metrics) {
    return dynamic;
  }
  const { metrics } = result;

  // 1. Fires the scenario will start later (scripted incident).
  scriptedFirePrompts(options?.input, fires).forEach(pushPrompt);

  // 2. Critical deficit handling
  if (metrics.criticalUnservedKwh > 0) {
    if (activeStrategy !== 'essential_first') {
      pushPrompt({
        key: 'promptSwitchStrategy',
        params: { strategy: 'essential_first' },
      });
    }

    const firstAffected = metrics.affectedSectors[0];
    if (firstAffected) {
      pushPrompt({
        key: 'promptWhySector',
        params: { sector: firstAffected },
      });
    }
  }

  // 3. Warnings with specific hours
  // Only shortage warnings: CURTAILMENT / RESERVE_REACHED are not a deficit.
  const warningWithHours = result.warnings?.find(
    (w) => w.code === 'CRITICAL_UNMET' || w.code === 'SECTOR_PARTIAL'
  );
  if (warningWithHours) {
    pushPrompt({
      key: 'promptDeficitHours',
      params: { hours: `${warningWithHours.fromHour}-${warningWithHours.toHour}` },
    });
  }

  // 4. The scenario's own weather / demand events
  eventPrompts(options?.input).forEach(pushPrompt);

  // 5. Proportional strategy with deficit -> recommend comparing strategies
  if (activeStrategy === 'proportional' && metrics.unservedKwh > 0) {
    pushPrompt({ key: 'promptCompareStrategies' });
  }

  // 6. Any unmet demand
  if (metrics.unservedKwh > 0) {
    pushPrompt({ key: 'promptUnmetDemand' });
  }

  // 7. Deep battery discharge
  if (metrics.socMinPct < 25) {
    pushPrompt({ key: 'promptBatteryState' });
  }

  // 8. Calm day: what-if questions built on this run's numbers.
  if (dynamic.length < MIN_RESULT_PROMPTS) {
    pushPrompt({ key: 'promptBatteryEnd', params: { pct: Math.round(metrics.socEndPct) } });
    if (metrics.curtailedKwh > 0) {
      pushPrompt({
        key: 'promptCurtailed',
        params: { kwh: Math.round(metrics.curtailedKwh * 10) / 10 },
      });
    }
    if (metrics.unservedKwh === 0) {
      pushPrompt({ key: 'promptSolarDrop40' });
      pushPrompt({ key: 'promptProtectEssential' });
    }
  }

  // 9. Multi-day scenario crafting prompt (PA-T8g) - only on calm simulations without active fires
  if (fires.length === 0 && dynamic.length < MAX_PROMPTS) {
    pushPrompt({ key: 'promptDescribeMultiDay' });
  }

  return dynamic;
}
