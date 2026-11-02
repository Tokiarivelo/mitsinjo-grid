import { describe, expect, it } from 'vitest';
import { scenarios } from '@mitsinjo/engine';
import { autopilotProposal } from '../autopilot';

describe('autopilotProposal (M10-T1, rule-based)', () => {
  it('no critical short → no suggestion', () => {
    expect(autopilotProposal(scenarios.baseline.input, 12, 'proportional')).toBeNull();
  });

  it('R1: clinic short fixable by another strategy → propose the switch', () => {
    const input = scenarios.essential_stress.input;
    const hit = autopilotProposal(input, 18, 'proportional');
    expect(hit).not.toBeNull();
    expect(hit?.rule).toBe('strategy');
    expect(hit?.strategy).toBe('essential_first');
    expect(hit?.hour).toBe(18);
  });

  it('R2: clinic short no strategy fixes → health lifeline floor', () => {
    const input = scenarios.essential_stress.input;
    const hit = autopilotProposal(input, 20, 'essential_first');
    expect(hit).not.toBeNull();
    expect(hit?.rule).toBe('lifeline');
    expect(hit?.patch?.lifeline?.kw?.health).toBeGreaterThan(0);
    expect(hit?.patch?.lifeline?.kw?.health).toBeLessThanOrEqual(2);
  });

  it('constitution: forbidden strategy falls through to R2 instead (M10-T2)', () => {
    const input = scenarios.essential_stress.input;
    const hit = autopilotProposal(input, 18, 'proportional', [
      { id: 'r', kind: 'strategy_only', strategies: ['proportional', 'balanced'] },
    ]);
    // R1 (essential_first) is forbidden, so R2 answers with a lifeline floor.
    expect(hit?.rule).toBe('lifeline');
    expect(hit?.patch?.lifeline?.kw?.health).toBeGreaterThan(0);
  });

  it('constitution: violating lifeline floor → silence (M10-T2)', () => {
    const input = scenarios.essential_stress.input;
    const hit = autopilotProposal(input, 20, 'essential_first', [
      { id: 'r', kind: 'min_floor', sector: 'health', kw: 2 },
    ]);
    // R2's proposed floor is below 2 kW, so the constitution blocks it.
    expect(hit).toBeNull();
  });

  it('R2 covered already → nothing to do', () => {
    const input = {
      ...scenarios.essential_stress.input,
      sectors: scenarios.essential_stress.input.sectors.map((s) =>
        s.id === 'health' ? { ...s, lifelineKw: 2 } : s
      ),
    };
    expect(autopilotProposal(input, 20, 'essential_first')).toBeNull();
  });
});
