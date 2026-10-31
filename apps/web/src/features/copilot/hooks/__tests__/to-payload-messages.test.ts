import { describe, it, expect } from 'vitest';
import { payloadBaseCount, toPayloadMessages } from '../use-copilot';
import { COPILOT_PAYLOAD_MAX } from '../../utils/history';
import type { ChatMessageData } from '../../types';

describe('toPayloadMessages', () => {
  it('drops error bubbles and empty assistant turns so the next request stays valid', () => {
    const payload = toPayloadMessages([
      { id: '1', role: 'user', content: 'Compare the strategies.' },
      { id: '2', role: 'assistant', content: '' }, // loop failed before any delta
      { id: '3', role: 'error', content: '', errorKey: 'errorGeneric' },
      { id: '4', role: 'user', content: 'Try again' },
    ]);
    expect(payload).toEqual([
      { role: 'user', content: 'Compare the strategies.' },
      { role: 'user', content: 'Try again' },
    ]);
  });

  it('preserves attached media items and includes messages with media even if content is empty', () => {
    const payload = toPayloadMessages([
      {
        id: '1',
        role: 'user',
        content: '',
        media: [{ id: 'm1', url: 'data:image/png;base64,abc', type: 'image' }],
      },
      {
        id: '2',
        role: 'user',
        content: 'Check this diagram',
        media: [{ id: 'm2', url: 'https://example.com/video.mp4', type: 'video' }],
      },
    ]);
    expect(payload).toEqual([
      {
        role: 'user',
        content: '',
        media: [{ type: 'image', url: 'data:image/png;base64,abc' }],
      },
      {
        role: 'user',
        content: 'Check this diagram',
        media: [{ type: 'video', url: 'https://example.com/video.mp4' }],
      },
    ]);
  });

  it('sends at most COPILOT_PAYLOAD_MAX messages and keeps R2 keys', () => {
    const many = Array.from({ length: COPILOT_PAYLOAD_MAX + 5 }, (_, i) => ({
      id: `${i}`,
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `m${i}`,
    }));
    const payload = toPayloadMessages([
      ...many,
      {
        id: 'k',
        role: 'user',
        content: 'photo',
        media: [{ id: 'm', type: 'image', url: 'https://r2/x', key: 'copilot/1-x.png' }],
      },
    ]);
    expect(payload).toHaveLength(COPILOT_PAYLOAD_MAX);
    expect(payload.at(-1)?.media).toEqual([
      { type: 'image', url: 'https://r2/x', key: 'copilot/1-x.png' },
    ]);
  });

  const chat = (n: number): ChatMessageData[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `m${i}`,
    }));

  it('skips the messages already folded into the summary', () => {
    const msgs = chat(10);
    const payload = toPayloadMessages(msgs, 6);
    expect(payload.map((m) => m.content)).toEqual(['m6', 'm7', 'm8', 'm9']);
    expect(payloadBaseCount(msgs, 6)).toBe(6);
  });

  it('counts messages beyond COPILOT_PAYLOAD_MAX in the base count', () => {
    expect(payloadBaseCount(chat(COPILOT_PAYLOAD_MAX + 3), 0)).toBe(3);
  });

  it('sends an operator decision as a user turn the model can read', () => {
    const payload = toPayloadMessages([
      {
        id: 'd',
        role: 'decision',
        content: '',
        decision: {
          proposalId: 'PROP-1',
          status: 'approved',
          items: [],
          patch: { solarDropPct: 40 },
        },
      },
    ]);
    expect(payload).toHaveLength(1);
    expect(payload[0]?.role).toBe('user');
    expect(payload[0]?.content).toContain('APPROVED proposal PROP-1');
    expect(payload[0]?.content).toContain('"solarDropPct":40');
  });
});
