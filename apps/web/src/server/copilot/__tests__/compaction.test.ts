import { describe, it, expect, vi } from 'vitest';
import {
  capSummary,
  planCompaction,
  scrubNumbers,
  summarizeTurns,
  KEEP_RECENT,
  COMPACT_MAX_MESSAGES,
} from '../compaction';
import type { HistoryMessage } from '../history';
import type { LlmProvider } from '../provider';

const turns = (n: number, size: number): HistoryMessage[] =>
  Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `turn ${i} ${'x'.repeat(size)}`,
  }));

describe('auto-compaction', () => {
  it('keeps a short history as it is', () => {
    expect(planCompaction(turns(4, 5000))).toBeNull(); // too few messages to fold
    expect(planCompaction(turns(20, 100))).toBeNull(); // under the token limit
  });

  it('also folds past COMPACT_MAX_MESSAGES short messages', () => {
    const plan = planCompaction(turns(COMPACT_MAX_MESSAGES + 2, 10));
    expect(plan?.fold).toHaveLength(COMPACT_MAX_MESSAGES + 2 - KEEP_RECENT);
  });

  it('folds older turns and keeps the last KEEP_RECENT when over the limit', () => {
    const msgs = turns(20, 2000);
    const plan = planCompaction(msgs, 1000);
    expect(plan?.keep).toHaveLength(KEEP_RECENT);
    expect(plan?.fold).toHaveLength(20 - KEEP_RECENT);
    expect(plan?.keep.at(-1)).toBe(msgs.at(-1));
  });

  it('removes energy figures but keeps hours and names', () => {
    expect(scrubNumbers('Clinic got 12.5 kWh, market 30 %, peak 4 kW at 18h')).toBe(
      'Clinic got [number: ask a tool], market [number: ask a tool], peak [number: ask a tool] at 18h'
    );
  });

  it('caps the summary by dropping its oldest lines', () => {
    const text = ['- a'.repeat(10), '- b'.repeat(10), '- c'.repeat(10)].join('\n');
    expect(capSummary(text, 70)).toBe(['- b'.repeat(10), '- c'.repeat(10)].join('\n'));
  });

  it('mock provider: one line per operator turn, appended to the previous summary', async () => {
    const mock: LlmProvider = { name: 'mock', chat: vi.fn() };
    const out = await summarizeTurns(mock, '- Operator: earlier', [
      { role: 'user', content: 'Cut the market tonight at 2 kW' },
      { role: 'assistant', content: 'I propose…' },
    ]);
    expect(out).toBe(
      '- Operator: earlier\n- Operator: Cut the market tonight at [number: ask a tool]'
    );
    expect(mock.chat).not.toHaveBeenCalled();
  });

  it('real provider: no tools, numbers scrubbed; empty answer throws', async () => {
    const chat = vi.fn().mockResolvedValue({ content: '- Asked about 40 % solar drop' });
    const out = await summarizeTurns({ name: 'meta', chat }, undefined, turns(2, 10));
    expect(out).toBe('- Asked about [number: ask a tool] solar drop');
    expect(chat.mock.calls[0]?.[1]).toEqual([]);
    await expect(
      summarizeTurns({ name: 'meta', chat: vi.fn().mockResolvedValue({}) }, undefined, turns(2, 10))
    ).rejects.toThrow();
  });
});
