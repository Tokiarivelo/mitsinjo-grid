import {
  AutoActionSchema,
  DEFAULT_CONSTITUTION,
  checkConstitution,
  dispatchLogHash,
  type AutoAction,
  type ConstitutionRule,
  type DispatchLogEntry,
  type DispatchSnapshot,
  type InputPatch,
  type SectorId,
  type SimulationInput,
  type SimulationResult,
  type StrategyId,
} from '@mitsinjo/engine';

/** Max length of a narration text (`NarrationSchema`). */
const NARRATION_MAX = 400;

/** Adds the audit hash to a log line. */
export function sealLogEntry(draft: Omit<DispatchLogEntry, 'hash'>): DispatchLogEntry {
  return { ...draft, hash: dispatchLogHash(draft) };
}

/** Engine figures of a full-day run, for a log line's before/after. */
export function resultSnapshot(result: SimulationResult): DispatchSnapshot {
  return {
    resultId: result.id,
    unservedKwh: result.metrics.unservedKwh,
    criticalUnservedKwh: result.metrics.criticalUnservedKwh,
    socEndPct: result.metrics.socEndPct,
  };
}

/** Lifeline floors after the patch, for the constitution's `min_floor` rules. */
function patchedFloors(
  input: SimulationInput,
  patch: InputPatch | undefined
): Partial<Record<SectorId, number>> | undefined {
  if (!patch?.lifeline) return undefined;
  if (patch.lifeline.enabled === false) {
    return Object.fromEntries(input.sectors.map((s) => [s.id, 0]));
  }
  return patch.lifeline.kw;
}

/** Maps a patch/strategy to the action kind it performs; null when no kind fits. */
function toAutoAction(patch: InputPatch | undefined, strategy?: StrategyId): AutoAction | null {
  const draft = strategy
    ? { kind: 'switch_strategy' as const, strategy, ...(patch ? { patch } : {}) }
    : patch?.sectorCaps?.[0]
      ? {
          kind: 'cap_sector' as const,
          sector: patch.sectorCaps[0].sector,
          patch,
        }
      : patch?.lifeline
        ? { kind: 'raise_clinic_floor' as const, patch }
        : null;
  if (!draft) return null;
  const parsed = AutoActionSchema.safeParse(draft);
  return parsed.success ? parsed.data : null;
}

/**
 * Action a copilot proposal performs when it may apply alone in autonomous mode (PA-T3c),
 * or null when it needs the operator's tap: it breaks the village constitution, it clears a
 * fire (never re-energise a burning sector without a human), or no action kind fits it.
 */
export function operatorAutoAction(
  input: SimulationInput,
  proposal: { patch?: InputPatch; strategy?: StrategyId },
  rules: readonly ConstitutionRule[] = DEFAULT_CONSTITUTION
): AutoAction | null {
  if (proposal.patch?.clearFires?.length) return null;
  const { violations } = checkConstitution(rules, {
    patch: proposal.patch,
    strategy: proposal.strategy,
    floors: patchedFloors(input, proposal.patch),
  });
  if (violations.length > 0) return null;
  return toAutoAction(proposal.patch, proposal.strategy);
}

/** Log line of an operator request applied alone in autonomous mode. */
export function operatorLogEntry(args: {
  id: string;
  day: number;
  hour: number;
  action: AutoAction;
  before: SimulationResult;
  after: SimulationResult;
  reason: string;
}): DispatchLogEntry {
  const reason = args.reason.trim().slice(0, NARRATION_MAX);
  return sealLogEntry({
    id: args.id,
    day: args.day,
    hour: args.hour,
    mode: 'autonomous',
    origin: 'operator',
    action: args.action,
    before: resultSnapshot(args.before),
    after: resultSnapshot(args.after),
    ...(reason ? { narration: { text: reason, source: 'llm' as const } } : {}),
  });
}
