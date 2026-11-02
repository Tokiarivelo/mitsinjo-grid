import { describe, expect, it, vi } from 'vitest';
import { applyPatch, scenarios, simulate } from '@mitsinjo/engine';
import { runCouncil } from '../deliberate';

const cloudyInput = scenarios.cloudy_afternoon.input;

describe('runCouncil (M7-T1)', () => {
  it('convenes one agent per connected sector, each proposal engine-simulated', async () => {
    const run = await runCouncil({
      input: cloudyInput,
      strategy: 'proportional',
      question: 'Who should shed load tonight?',
      chat: async () => {
        throw new Error('mock council must not call the chat model');
      },
      isMock: true,
      canSpend: () => true,
      recordSpend: () => {},
    });

    // 5 connected sectors (the factory ships disconnected).
    expect(run.agents).toHaveLength(5);
    expect(run.agents.map((a) => a.sector)).toEqual([
      'health',
      'water',
      'school',
      'households',
      'market',
    ]);
    for (const agent of run.agents) {
      expect(agent.mock).toBe(true);
      expect(agent.reason.length).toBeGreaterThan(0);
      // The impact is a real before/after of THIS agent's patch.
      const expectedAfter = simulate(applyPatch(cloudyInput, agent.patch), 'proportional');
      expect(agent.impact.afterResultId).toBe(expectedAfter.id);
    }
  });

  it('the mock mediator picks the lowest unserved energy', async () => {
    const run = await runCouncil({
      input: cloudyInput,
      strategy: 'proportional',
      question: 'Who should shed load tonight?',
      chat: async () => {
        throw new Error('mock council must not call the chat model');
      },
      isMock: true,
      canSpend: () => true,
      recordSpend: () => {},
    });

    expect(run.verdict.mock).toBe(true);
    const best = [...run.agents].sort(
      (a, b) => a.impact.unservedKwhAfter - b.impact.unservedKwhAfter
    )[0]!;
    expect(run.verdict.pick).toBe(best.sector);
    expect(run.verdict.synthesis).toContain(best.sector);
  });

  it('paid agents answer through the chat model and bill their usage', async () => {
    const recordSpend = vi.fn();
    const chat = vi.fn(async (system: string) => ({
      text: system.includes('mediate')
        ? JSON.stringify({ pick: 'health', synthesis: 'Adopt the clinic floor.' })
        : JSON.stringify({
            patch: { priorities: { health: 'critical' } },
            reason: 'Clinic first.',
          }),
      usage: { inputTokens: 100, outputTokens: 20 },
    }));
    const run = await runCouncil({
      input: cloudyInput,
      strategy: 'proportional',
      question: 'Who should shed load tonight?',
      chat,
      isMock: false,
      canSpend: () => true,
      recordSpend,
      model: 'muse-spark-1.3',
    });

    expect(chat).toHaveBeenCalledTimes(6); // 5 agents + mediator
    expect(run.agents.every((a) => !a.mock)).toBe(true);
    expect(run.verdict.mock).toBe(false);
    expect(recordSpend).toHaveBeenCalledWith('muse-spark-1.3', {
      inputTokens: 100,
      outputTokens: 20,
    });
  });

  it('spend cap: remaining agents fall back to mock personas, fallback emitted once', async () => {
    const emitFallback = vi.fn();
    let calls = 0;
    const run = await runCouncil({
      input: cloudyInput,
      strategy: 'proportional',
      question: 'Who should shed load tonight?',
      chat: async () => {
        calls += 1;
        return { text: JSON.stringify({ patch: {}, reason: 'Paid voice.' }) };
      },
      isMock: false,
      // Cap reached after 2 paid calls.
      canSpend: () => calls < 2,
      recordSpend: () => {},
      emitFallback,
    });

    expect(run.agents.filter((a) => !a.mock)).toHaveLength(2);
    expect(run.agents.filter((a) => a.mock)).toHaveLength(3);
    expect(run.verdict.mock).toBe(true);
    expect(emitFallback).toHaveBeenCalledTimes(1);
  });

  it('maxRounds caps deliberation rounds', async () => {
    const chat = vi.fn(async () => ({
      text: JSON.stringify({ patch: {}, reason: 'Paid voice.' }),
    }));
    const one = await runCouncil({
      input: cloudyInput,
      strategy: 'proportional',
      question: 'Q?',
      chat,
      isMock: false,
      canSpend: () => true,
      recordSpend: () => {},
      maxRounds: 1,
    });
    expect(one.rounds).toBe(1);
    expect(chat).toHaveBeenCalledTimes(6);

    chat.mockClear();
    const two = await runCouncil({
      input: cloudyInput,
      strategy: 'proportional',
      question: 'Q?',
      chat,
      isMock: false,
      canSpend: () => true,
      recordSpend: () => {},
      maxRounds: 2,
    });
    expect(two.rounds).toBe(2);
    expect(chat).toHaveBeenCalledTimes(11); // 5 agents × 2 rounds + 1 mediator
  });

  it('an unparsable paid answer degrades to that agent’s mock patch', async () => {
    const run = await runCouncil({
      input: cloudyInput,
      strategy: 'proportional',
      question: 'Q?',
      chat: async () => ({ text: 'not json at all' }),
      isMock: false,
      canSpend: () => true,
      recordSpend: () => {},
    });
    // Garbage from the model degrades every seat (agents + mediator) to mock.
    expect(run.agents.every((a) => a.mock)).toBe(true);
    expect(run.agents).toHaveLength(5);
    expect(run.verdict.mock).toBe(true);
  });
});
