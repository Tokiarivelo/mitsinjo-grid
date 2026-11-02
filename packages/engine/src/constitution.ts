import { z } from 'zod';
import { SectorIdSchema, StrategyIdSchema } from './schemas/common';
import type { InputPatch, SectorId, StrategyId } from './schemas';

/**
 * Village constitution (M10-T2, PA-T2b): rules stored as data, verified by pure engine code.
 * The AI autonomous dispatch and autopilot never apply/propose a change that breaks them.
 */

export const CONSTITUTION_RULES = ['never_cut', 'min_floor', 'strategy_only'] as const;
export type ConstitutionKind = (typeof CONSTITUTION_RULES)[number];

export const ConstitutionRuleSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().min(1).max(40),
    kind: z.literal('never_cut'),
    sector: SectorIdSchema,
  }),
  z.object({
    id: z.string().min(1).max(40),
    kind: z.literal('min_floor'),
    sector: SectorIdSchema,
    kw: z.number().min(0).max(2),
  }),
  z.object({
    id: z.string().min(1).max(40),
    kind: z.literal('strategy_only'),
    strategies: z.array(StrategyIdSchema).min(1),
  }),
]);
export type ConstitutionRule = z.infer<typeof ConstitutionRuleSchema>;

export interface ConstitutionViolation {
  ruleId: string;
  reason: string;
}

export interface ConstitutionProposal {
  patch?: InputPatch;
  strategy?: StrategyId;
  /** Resulting lifeline floors after the patch (caller overlays current + patch). */
  floors?: Partial<Record<SectorId, number>>;
}

/** Village defaults: the clinic is never cut and keeps at least 0.5 kW of floor. */
export const DEFAULT_CONSTITUTION: ConstitutionRule[] = [
  { id: 'clinic-never-cut', kind: 'never_cut', sector: 'health' },
  { id: 'clinic-floor', kind: 'min_floor', sector: 'health', kw: 0.5 },
];

export function checkConstitution(
  rules: readonly ConstitutionRule[],
  proposal: ConstitutionProposal
): { violations: ConstitutionViolation[]; unknownKinds: string[] } {
  const violations: ConstitutionViolation[] = [];
  const unknownKinds: string[] = [];
  for (const rule of rules) {
    if (rule.kind === 'never_cut') {
      const cut = proposal.patch?.sectorCaps?.some(
        (c) => c.sector === rule.sector && c.maxKw === 0
      );
      if (cut) violations.push({ ruleId: rule.id, reason: `never_cut:${rule.sector}` });
    } else if (rule.kind === 'min_floor') {
      const floor = proposal.floors?.[rule.sector];
      if (floor !== undefined && floor < rule.kw) {
        violations.push({ ruleId: rule.id, reason: `min_floor:${rule.sector}` });
      }
    } else if (rule.kind === 'strategy_only') {
      if (proposal.strategy !== undefined && !rule.strategies.includes(proposal.strategy)) {
        violations.push({ ruleId: rule.id, reason: `strategy_only:${proposal.strategy}` });
      }
    } else {
      unknownKinds.push((rule as { kind: string }).kind);
    }
  }
  return { violations, unknownKinds };
}
