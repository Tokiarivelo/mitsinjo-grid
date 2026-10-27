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
});
