import { describe, it, expect } from 'vitest';
import { suggestPrompts } from '../suggest-prompts';
import { scenarios, simulate, type DispatchLogEntry } from '@mitsinjo/engine';
import { sealLogEntry } from '@/lib/dispatch-log';

describe('suggestPrompts with dispatchLog (PA-T5b)', () => {
  const result = simulate(scenarios.baseline.input, 'proportional');

  it('generates dispatch questions when dispatch log has autonomous actions', () => {
    const dispatchLog: DispatchLogEntry[] = [
      sealLogEntry({
        id: 'act-1',
        day: 0,
        hour: 14,
        mode: 'autonomous',
        origin: 'ai',
        incident: {
          kind: 'fire',
          severity: 'critical',
          day: 0,
          hour: 14,
          sector: 'market',
          evidence: { activeFire: 1 },
        },
        action: {
          kind: 'isolate_sector',
          sector: 'market',
          answers: 'fire',
          patch: { sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 14, toHour: 24 }] },
        },
      }),
      sealLogEntry({
        id: 'act-2',
        day: 0,
        hour: 16,
        mode: 'autonomous',
        origin: 'ai',
        action: {
          kind: 'shed_flexible',
          sector: 'industry',
          patch: { sectorCaps: [{ sector: 'industry', maxKw: 0, fromHour: 16, toHour: 20 }] },
        },
      }),
    ];

    const prompts = suggestPrompts({ result, dispatchLog });

    const whyAction = prompts.find((p) => p.key === 'promptWhyDispatchAction');
    expect(whyAction).toBeDefined();
    expect(whyAction?.params?.action).toBe('shed_flexible');
    expect(whyAction?.params?.sector).toBe('industry');
    expect(whyAction?.params?.hour).toBe(16);

    const summaryPrompt = prompts.find((p) => p.key === 'promptDispatchSummary');
    expect(summaryPrompt).toBeDefined();
  });
});
