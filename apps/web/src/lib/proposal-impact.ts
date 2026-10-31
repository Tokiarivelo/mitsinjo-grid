import {
  applyPatch,
  changeImpact,
  simulate,
  type ChangeImpact,
  type InputPatch,
  type SimulationInput,
  type StrategyId,
} from '@mitsinjo/engine';

const round2 = (val: number) => Math.round(val * 100) / 100;

/**
 * Engine impact of a proposal, rounded for display. Keeps only sectors whose served energy
 * or off hours change, so the dialog and the evidence list the same numbers.
 */
export function compactImpact(impact: ChangeImpact): ChangeImpact {
  const sectors: ChangeImpact['sectors'] = {};
  for (const [id, s] of Object.entries(impact.sectors)) {
    if (!s) continue;
    const delta = round2(s.servedKwhDelta);
    if (delta === 0 && s.offHoursAfter === s.offHoursBefore) continue;
    sectors[id as keyof ChangeImpact['sectors']] = {
      servedKwhBefore: round2(s.servedKwhBefore),
      servedKwhAfter: round2(s.servedKwhAfter),
      servedKwhDelta: delta,
      offHoursBefore: s.offHoursBefore,
      offHoursAfter: s.offHoursAfter,
    };
  }
  return {
    ...impact,
    socMinPctBefore: round2(impact.socMinPctBefore),
    socMinPctAfter: round2(impact.socMinPctAfter),
    unservedKwhBefore: round2(impact.unservedKwhBefore),
    unservedKwhAfter: round2(impact.unservedKwhAfter),
    sectors,
  };
}

/**
 * Before / after of a change (K1): `input` + `strategy` vs the patched input + proposed strategy.
 * Same computation on the server (propose_change) and in the dialog (partial approval, K3).
 * Throws when the patch cannot be applied.
 */
export function proposalImpact(
  input: SimulationInput,
  strategy: StrategyId,
  patch?: InputPatch,
  proposedStrategy?: StrategyId
): { impact: ChangeImpact; afterResultId: string } {
  const before = simulate(input, strategy);
  const after = simulate(patch ? applyPatch(input, patch) : input, proposedStrategy ?? strategy);
  return { impact: compactImpact(changeImpact(before, after)), afterResultId: after.id };
}
