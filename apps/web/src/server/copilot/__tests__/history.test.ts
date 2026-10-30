import { describe, it, expect } from 'vitest';
import { compactHistory, OLD_ANSWER_MAX_CHARS, type HistoryMessage } from '../history';
import { COPILOT_HISTORY_LIMIT } from '@/features/copilot/utils/history';

const long = 'x'.repeat(OLD_ANSWER_MAX_CHARS + 200);
const img = (url: string) => [{ type: 'image' as const, url }];

describe('compactHistory', () => {
  it('keeps only the last COPILOT_HISTORY_LIMIT messages', () => {
    const msgs: HistoryMessage[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `m${i}`,
    }));
    const out = compactHistory(msgs);
    expect(out).toHaveLength(COPILOT_HISTORY_LIMIT);
    expect(out.at(-1)?.content).toBe('m19');
  });

  it('sends media only with the latest user message', () => {
    const out = compactHistory([
      { role: 'user', content: 'Sky photo', media: img('https://a') },
      { role: 'assistant', content: 'Cloudy.' },
      { role: 'user', content: 'And this meter?', media: img('https://b') },
    ]);
    expect(out[0]?.media).toBeUndefined();
    expect(out[0]?.content).toContain('Sky photo');
    expect(out[0]?.content).toContain('not re-sent');
    expect(out[2]?.media).toEqual(img('https://b'));
  });

  it('a text follow-up drops the earlier image too', () => {
    const out = compactHistory([
      { role: 'user', content: '', media: img('https://a') },
      { role: 'assistant', content: 'Cloudy.' },
      { role: 'user', content: 'Why?' },
    ]);
    expect(out.every((m) => !m.media)).toBe(true);
    expect(out[0]?.content.length).toBeGreaterThan(0);
  });

  it('cuts older assistant answers, keeps the latest one whole', () => {
    const out = compactHistory([
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: long },
      { role: 'user', content: 'q2' },
      { role: 'assistant', content: long },
      { role: 'user', content: 'q3' },
    ]);
    expect(out[1]?.content.length).toBe(OLD_ANSWER_MAX_CHARS + 1); // + ellipsis
    expect(out[3]?.content).toBe(long);
  });

  it('does not mutate the input', () => {
    const msgs: HistoryMessage[] = [
      { role: 'user', content: 'a', media: img('https://a') },
      { role: 'user', content: 'b' },
    ];
    compactHistory(msgs);
    expect(msgs[0]?.media).toHaveLength(1);
  });
});
