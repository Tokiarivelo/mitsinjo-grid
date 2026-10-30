import { describe, it, expect } from 'vitest';
import { decisionToModelText, proposalDecisions } from '../decisions';
import type { ChatMessageData } from '../../types';

describe('proposal decisions', () => {
  it('maps each proposal id to its decision (latest wins)', () => {
    const msgs: ChatMessageData[] = [
      { id: '1', role: 'assistant', content: 'x' },
      {
        id: '2',
        role: 'decision',
        content: '',
        decision: { proposalId: 'A', status: 'rejected', items: [] },
      },
      {
        id: '3',
        role: 'decision',
        content: '',
        decision: { proposalId: 'B', status: 'approved', items: [] },
      },
    ];
    const out = proposalDecisions(msgs);
    expect(out.A?.status).toBe('rejected');
    expect(out.B?.status).toBe('approved');
  });

  it('tells the model plainly what happened', () => {
    expect(
      decisionToModelText({ proposalId: 'P', status: 'rejected', items: [], strategy: 'balanced' })
    ).toBe(
      '[Operator decision] REJECTED proposal P. Nothing was changed. Change not applied: {"strategy":"balanced"}'
    );
  });
});
