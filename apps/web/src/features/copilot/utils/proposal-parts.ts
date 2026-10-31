import type { InputPatch, StrategyId } from '@mitsinjo/engine';
import type { CopilotProposal, ProposalDiffItem } from '../types';

/** What gets applied: the whole proposal or only the lines the operator kept checked (K3). */
export interface ProposalPick {
  patch?: InputPatch;
  strategy?: StrategyId;
}

/** Partial approval (K3): what the checked lines apply, and the lines left out. */
export interface PartialApproval {
  pick: ProposalPick;
  skipped: ProposalDiffItem[];
}

/** Diff row ids of a proposal, one per line the dialog shows, in display order. */
export function proposalPartIds(proposal: Pick<CopilotProposal, 'patch' | 'strategy'>): string[] {
  const { patch, strategy } = proposal;
  const ids: string[] = [];
  if (strategy !== undefined) ids.push('strategy');
  for (const [sector, prio] of Object.entries(patch?.priorities ?? {})) {
    if (prio) ids.push(`priorities.${sector}`);
  }
  (patch?.sectorCaps ?? []).forEach((_, i) => ids.push(`sectorCaps.${i}`));
  if (patch?.solarDropPct !== undefined) ids.push('solarDropPct');
  if (patch?.dropStartHour !== undefined || patch?.dropDurationH !== undefined) {
    ids.push('dropWindow');
  }
  if (patch?.demandMultiplier !== undefined) ids.push('demandMultiplier');
  if (patch?.batteryCapacityKwh !== undefined) ids.push('batteryCapacityKwh');
  if (patch?.initialSocPct !== undefined) ids.push('initialSocPct');
  if (patch?.minSocPct !== undefined) ids.push('minSocPct');
  if (patch?.lifeline?.enabled !== undefined) ids.push('lifeline.enabled');
  for (const [sector, kw] of Object.entries(patch?.lifeline?.kw ?? {})) {
    if (kw !== undefined) ids.push(`lifeline.kw.${sector}`);
  }
  for (const [sector, mult] of Object.entries(patch?.sectorLoads ?? {})) {
    if (mult !== undefined) ids.push(`sectorLoads.${sector}`);
  }
  return ids;
}

/** Keeps the entries of a sector map whose `<prefix>.<sector>` id is checked; undefined when none. */
function pickMap<T>(
  map: Partial<Record<string, T>> | undefined,
  prefix: string,
  keep: Set<string>
): Partial<Record<string, T>> | undefined {
  if (!map) return undefined;
  const out = Object.fromEntries(
    Object.entries(map).filter(([sector]) => keep.has(`${prefix}.${sector}`))
  );
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * The part of a proposal to apply when only `checked` lines are kept (K3, partial approval).
 * Patch fields the dialog does not list (solar profile, meter readings, shares, weights) always go
 * with the patch. Returns `{}` when nothing is left.
 */
export function pickProposal(
  proposal: Pick<CopilotProposal, 'patch' | 'strategy'>,
  checked: Iterable<string>
): ProposalPick {
  const keep = new Set(checked);
  const src = proposal.patch;
  const patch: Record<string, unknown> = {};

  if (src) {
    const listed = new Set([
      'priorities',
      'sectorCaps',
      'solarDropPct',
      'dropStartHour',
      'dropDurationH',
      'demandMultiplier',
      'batteryCapacityKwh',
      'initialSocPct',
      'minSocPct',
      'lifeline',
      'sectorLoads',
    ]);
    for (const [key, value] of Object.entries(src)) {
      if (!listed.has(key) && value !== undefined) patch[key] = value;
    }

    const priorities = pickMap(src.priorities, 'priorities', keep);
    if (priorities) patch.priorities = priorities;

    const caps = (src.sectorCaps ?? []).filter((_, i) => keep.has(`sectorCaps.${i}`));
    if (caps.length > 0) patch.sectorCaps = caps;

    for (const key of [
      'solarDropPct',
      'demandMultiplier',
      'batteryCapacityKwh',
      'initialSocPct',
      'minSocPct',
    ] as const) {
      if (src[key] !== undefined && keep.has(key)) patch[key] = src[key];
    }
    if (keep.has('dropWindow')) {
      if (src.dropStartHour !== undefined) patch.dropStartHour = src.dropStartHour;
      if (src.dropDurationH !== undefined) patch.dropDurationH = src.dropDurationH;
    }

    const lifelineKw = pickMap(src.lifeline?.kw, 'lifeline.kw', keep);
    const lifelineOn = src.lifeline?.enabled !== undefined && keep.has('lifeline.enabled');
    if (lifelineOn || lifelineKw) {
      patch.lifeline = {
        ...(lifelineOn && { enabled: src.lifeline?.enabled }),
        ...(lifelineKw && { kw: lifelineKw }),
      };
    }

    const loads = pickMap(src.sectorLoads, 'sectorLoads', keep);
    if (loads) patch.sectorLoads = loads;
  }

  return {
    ...(Object.keys(patch).length > 0 && { patch: patch as InputPatch }),
    ...(proposal.strategy !== undefined && keep.has('strategy') && { strategy: proposal.strategy }),
  };
}
