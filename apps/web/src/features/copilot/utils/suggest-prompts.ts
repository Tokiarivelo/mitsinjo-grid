import type { SectorId, SimulationResult, StrategyId } from '@mitsinjo/engine';

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
  /** Sectors on fire at the shown hour (M2): their questions come first. */
  fires?: readonly SectorId[];
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

export const FALLBACK_STATIC_PROMPTS: SuggestedPromptItem[] = [
  { key: 'promptWhyClinic' },
  { key: 'promptCompareStrategies' },
  { key: 'promptSolarDrop40' },
  { key: 'promptUnmetDemand' },
  { key: 'promptBatteryState' },
  { key: 'promptProtectEssential' },
];

/**
 * Maps simulation results and active context to at most 6 contextual suggested prompts.
 * Pure function adhering to P6-T10.
 */
export function suggestPrompts(options?: SuggestPromptsOptions): SuggestedPromptItem[] {
  const result = options?.result;
  const activeStrategy = options?.activeStrategy ?? 'proportional';
  const fires = options?.fires ?? [];

  if (fires.length === 0 && (!result || !result.metrics)) {
    return [...FALLBACK_STATIC_PROMPTS];
  }

  const dynamic: SuggestedPromptItem[] = [];
  const addedKeys = new Set<string>();

  const pushPrompt = (item: SuggestedPromptItem) => {
    const id = `${item.key}:${item.params?.sector ?? ''}`;
    if (!addedKeys.has(id) && dynamic.length < 6) {
      addedKeys.add(id);
      dynamic.push(item);
    }
  };

  // 0. A fire burns now (M2): the incident comes first.
  firePrompts(fires).forEach(pushPrompt);

  if (!result || !result.metrics) {
    FALLBACK_STATIC_PROMPTS.forEach(pushPrompt);
    return dynamic;
  }

  // 1. Critical deficit handling
  if (result.metrics.criticalUnservedKwh > 0) {
    if (activeStrategy !== 'essential_first') {
      pushPrompt({
        key: 'promptSwitchStrategy',
        params: { strategy: 'essential_first' },
      });
    }

    const firstAffected = result.metrics.affectedSectors[0];
    if (firstAffected) {
      pushPrompt({
        key: 'promptWhySector',
        params: { sector: firstAffected },
      });
    }
  }

  // 2. Warnings with specific hours
  if (result.warnings && result.warnings.length > 0) {
    // Only shortage warnings: CURTAILMENT / RESERVE_REACHED are not a deficit.
    const warningWithHours = result.warnings.find(
      (w) => w.code === 'CRITICAL_UNMET' || w.code === 'SECTOR_PARTIAL'
    );
    if (warningWithHours) {
      pushPrompt({
        key: 'promptDeficitHours',
        params: { hours: `${warningWithHours.fromHour}-${warningWithHours.toHour}` },
      });
    }
  }

  // 3. Proportional strategy with deficit -> recommend comparing strategies
  if (activeStrategy === 'proportional' && result.metrics.unservedKwh > 0) {
    pushPrompt({ key: 'promptCompareStrategies' });
  }

  // 4. Any unmet demand
  if (result.metrics.unservedKwh > 0) {
    pushPrompt({ key: 'promptUnmetDemand' });
  }

  // 5. Deep battery discharge
  if (result.metrics.socMinPct < 25) {
    pushPrompt({ key: 'promptBatteryState' });
  }

  // 6. Fill remaining slots up to 6 from fallback defaults
  for (const fallback of FALLBACK_STATIC_PROMPTS) {
    if (dynamic.length >= 6) break;
    pushPrompt(fallback);
  }

  return dynamic.slice(0, 6);
}
