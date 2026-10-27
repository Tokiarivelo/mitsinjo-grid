import { describe, it, expect } from 'vitest';
import { MockLlmProvider } from '../providers/mock';
import { TOOL_DEFINITIONS } from '../tools';

describe('MockLlmProvider (P6-T1)', () => {
  const provider = new MockLlmProvider();

  it('has provider name mock', () => {
    expect(provider.name).toBe('mock');
  });

  it('triggers run_scenario for solar drop questions', async () => {
    const turn = await provider.chat(
      [{ role: 'user', content: 'What happens if solar drops 40 % for 2 hours?' }],
      TOOL_DEFINITIONS
    );
    expect(turn.toolCalls).toBeDefined();
    const call0 = turn.toolCalls?.[0];
    expect(call0?.name).toBe('run_scenario');
    expect((call0?.args as { patch?: unknown })?.patch).toMatchObject({
      solarDropPct: 40,
    });
  });

  it('triggers compare_strategies for comparison questions', async () => {
    const turn = await provider.chat(
      [{ role: 'user', content: 'Compare the strategies.' }],
      TOOL_DEFINITIONS
    );
    expect(turn.toolCalls).toBeDefined();
    expect(turn.toolCalls?.[0]?.name).toBe('compare_strategies');
  });

  it('triggers get_sector_metrics for clinic/health questions', async () => {
    const turn = await provider.chat(
      [{ role: 'user', content: 'Why does the clinic get less energy?' }],
      TOOL_DEFINITIONS
    );
    expect(turn.toolCalls).toBeDefined();
    const call0 = turn.toolCalls?.[0];
    expect(call0?.name).toBe('get_sector_metrics');
    expect(call0?.args['sector']).toBe('health');
  });

  it('refuses physical control requests directly without tool calls', async () => {
    const turn = await provider.chat(
      [{ role: 'user', content: "Turn off the market's power now." }],
      TOOL_DEFINITIONS
    );
    expect(turn.toolCalls).toBeUndefined();
    expect(turn.content).toContain('cannot perform physical hardware operations');
  });

  it('states simulation provenance when asked about real village telemetry', async () => {
    const turn = await provider.chat(
      [{ role: 'user', content: 'How much did the real village consume yesterday?' }],
      TOOL_DEFINITIONS
    );
    expect(turn.toolCalls).toBeUndefined();
    expect(turn.content).toContain('pure deterministic simulation model');
  });

  it('formats structured 4-section response from tool output', async () => {
    const turn = await provider.chat(
      [
        { role: 'user', content: 'Why does the clinic get less energy?' },
        {
          role: 'assistant',
          toolCalls: [{ id: 'call_1', name: 'get_sector_metrics', args: { sector: 'health' } }],
        },
        {
          role: 'tool',
          name: 'get_sector_metrics',
          toolCallId: 'call_1',
          content: JSON.stringify({
            resultId: 'SIM-A1B2C3',
            data: {
              sector: 'health',
              demandKwh: 14.8,
              servedKwh: 11.2,
              unservedKwh: 3.6,
              coveragePct: 75.7,
            },
          }),
        },
      ],
      TOOL_DEFINITIONS
    );

    expect(turn.content).toContain('### What happened');
    expect(turn.content).toContain('### Computed evidence');
    expect(turn.content).toContain('### Why it matters');
    expect(turn.content).toContain('### Explore next');
    expect(turn.content).toContain('SIM-A1B2C3');
    expect(turn.content).toContain('14.8 kWh');
    expect(turn.content).toContain('11.2 kWh');
    expect(turn.content).toContain('75.7%');
  });
});
