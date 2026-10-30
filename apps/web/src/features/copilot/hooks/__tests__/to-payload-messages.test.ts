import { describe, it, expect } from 'vitest';
import { toPayloadMessages } from '../use-copilot';
import { COPILOT_HISTORY_LIMIT } from '../../utils/history';

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

  it('sends only the last COPILOT_HISTORY_LIMIT messages and keeps R2 keys', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
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
    expect(payload).toHaveLength(COPILOT_HISTORY_LIMIT);
    expect(payload.at(-1)?.media).toEqual([
      { type: 'image', url: 'https://r2/x', key: 'copilot/1-x.png' },
    ]);
  });
});
