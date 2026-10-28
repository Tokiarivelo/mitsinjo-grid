import { describe, it, expect } from 'vitest';
import { toPayloadMessages } from '../use-copilot';

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
});
