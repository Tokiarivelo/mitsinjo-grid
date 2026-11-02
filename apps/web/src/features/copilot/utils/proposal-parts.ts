import type { Appliance, InputPatch, StrategyId } from '@mitsinjo/engine';
import type { CopilotProposal, ProposalDiffItem } from '../types';

/** Field-by-field equality: an unchanged patch line shows no diff row. */
export function sameAppliance(a: Appliance | undefined, b: Appliance | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.category === b.category &&
    a.sector === b.sector &&
    a.watts === b.watts &&
    a.quantity === b.quantity &&
    JSON.stringify(a.hourlyDuty ?? null) === JSON.stringify(b.hourlyDuty ?? null) &&
    JSON.stringify(a.position ?? null) === JSON.stringify(b.position ?? null)
  );
}

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

/**
 * Diff row ids of a proposal, one per line the dialog shows, in display order. `currentAppliances`
 * lists removals (current ids missing from the patch) and hides unchanged lines — pass the same
 * list `useProposalDiff` reads so ids and rows stay aligned.
 */
export function proposalPartIds(
  proposal: Pick<CopilotProposal, 'patch' | 'strategy'>,
  currentAppliances: Appliance[] = []
): string[] {
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
  for (const sector of patch?.clearFires ?? []) {
    ids.push(`clearFires.${sector}`);
  }
  // Appliance lines last, patch order then removals in current order (mirrored in useProposalDiff).
  const curById = new Map(currentAppliances.map((a) => [a.id, a]));
  const patchIds = new Set<string>();
  for (const a of patch?.appliances ?? []) {
    patchIds.add(a.id);
    if (!sameAppliance(curById.get(a.id), a)) ids.push(`appliances.${a.id}`);
  }
  if (patch?.appliances !== undefined) {
    for (const c of currentAppliances) {
      if (!patchIds.has(c.id)) ids.push(`appliances.${c.id}`);
    }
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
 * with the patch. Appliance lines need the current list to restore unchecked edits and removals.
 * Returns `{}` when nothing is left.
 */
export function pickProposal(
  proposal: Pick<CopilotProposal, 'patch' | 'strategy'>,
  checked: Iterable<string>,
  currentAppliances: Appliance[] = []
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
      'clearFires',
      'appliances',
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

    if (src.clearFires !== undefined) {
      const kept = src.clearFires.filter((s) => keep.has(`clearFires.${s}`));
      if (kept.length > 0) patch.clearFires = kept;
    }

    if (src.appliances !== undefined) {
      const curById = new Map(currentAppliances.map((a) => [a.id, a]));
      const out: Appliance[] = [];
      let differs = false;
      for (const a of src.appliances) {
        if (keep.has(`appliances.${a.id}`)) {
          out.push(a);
          if (!sameAppliance(curById.get(a.id), a)) differs = true;
        } else {
          // Unchecked edit → current line back; unchecked add → dropped.
          const c = curById.get(a.id);
          if (c) out.push(c);
        }
      }
      for (const c of currentAppliances) {
        const removed = !src.appliances.some((a) => a.id === c.id);
        if (!removed) continue;
        if (keep.has(`appliances.${c.id}`))
          differs = true; // removal stands
        else out.push(c); // unchecked removal → restored
      }
      if (differs) patch.appliances = out;
    }
  }

  return {
    ...(Object.keys(patch).length > 0 && { patch: patch as InputPatch }),
    ...(proposal.strategy !== undefined && keep.has('strategy') && { strategy: proposal.strategy }),
  };
}
