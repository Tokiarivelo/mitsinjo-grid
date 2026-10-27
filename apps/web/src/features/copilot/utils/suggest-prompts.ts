import type { SimulationResult, StrategyId } from '@mitsinjo/engine';

export interface SuggestedPromptItem {
  key: string;
  params?: Record<string, string | number>;
}

export interface SuggestPromptsOptions {
  result?: SimulationResult | null;
  activeStrategy?: StrategyId;
  scenarioId?: string;
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

  if (!result || !result.metrics) {
    return [...FALLBACK_STATIC_PROMPTS];
  }

  const dynamic: SuggestedPromptItem[] = [];
  const addedKeys = new Set<string>();

  const pushPrompt = (item: SuggestedPromptItem) => {
    if (!addedKeys.has(item.key) && dynamic.length < 6) {
      addedKeys.add(item.key);
      dynamic.push(item);
    }
  };

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
