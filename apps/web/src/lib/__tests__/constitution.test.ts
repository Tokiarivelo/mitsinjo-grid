import { describe, expect, it } from 'vitest';
import type { InputPatch, StrategyId } from '@mitsinjo/engine';
import { checkConstitution, CONSTITUTION_RULES, type ConstitutionRule } from '../constitution';

function violations(
  rules: ConstitutionRule[],
  proposal: { patch?: InputPatch; strategy?: StrategyId; floors?: Partial<Record<string, number>> }
) {
  return checkConstitution(rules, proposal).violations;
}

describe('checkConstitution (M10-T2, pure code)', () => {
  const neverCutHealth: ConstitutionRule = { id: 'r1', kind: 'never_cut', sector: 'health' };

  it('never_cut rejects a zero cap on that sector only', () => {
    expect(
      violations([neverCutHealth], {
        patch: { sectorCaps: [{ sector: 'health', maxKw: 0, fromHour: 18, toHour: 22 }] },
      })
    ).toEqual([{ ruleId: 'r1', reason: 'never_cut:health' }]);
    expect(
      violations([neverCutHealth], {
        patch: { sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 18, toHour: 22 }] },
      })
    ).toEqual([]);
    // A nonzero cap is a limit, not a cut.
    expect(
      violations([neverCutHealth], {
        patch: { sectorCaps: [{ sector: 'health', maxKw: 1, fromHour: 18, toHour: 22 }] },
      })
    ).toEqual([]);
  });

  it('min_floor rejects dropping the floor below the rule', () => {
    const rules: ConstitutionRule[] = [{ id: 'r2', kind: 'min_floor', sector: 'health', kw: 1 }];
    expect(
      violations(rules, {
        patch: { lifeline: { kw: { health: 0.4 } } },
        floors: { health: 0.4 },
      })
    ).toEqual([{ ruleId: 'r2', reason: 'min_floor:health' }]);
    expect(
      violations(rules, {
        patch: { lifeline: { kw: { health: 1.5 } } },
        floors: { health: 1.5 },
      })
    ).toEqual([]);
  });

  it('strategy_only rejects off-list strategies', () => {
    const rules: ConstitutionRule[] = [
      { id: 'r3', kind: 'strategy_only', strategies: ['essential_first', 'balanced'] },
    ];
    expect(violations(rules, { strategy: 'proportional' })).toEqual([
      { ruleId: 'r3', reason: 'strategy_only:proportional' },
    ]);
    expect(violations(rules, { strategy: 'balanced' })).toEqual([]);
    expect(violations(rules, { patch: { solarDropPct: 10 } })).toEqual([]);
  });

  it('unknown rule kinds never block (reported aside)', () => {
    const res = checkConstitution([{ id: 'rx', kind: 'no_fly_zone' } as never], {
      patch: { solarDropPct: 10 },
    });
    expect(res.violations).toEqual([]);
    expect(res.unknownKinds).toEqual(['no_fly_zone']);
    expect(CONSTITUTION_RULES).toEqual(['never_cut', 'min_floor', 'strategy_only']);
  });
});
