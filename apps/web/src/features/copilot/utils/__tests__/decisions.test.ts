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
    expect(decisionToModelText({ proposalId: 'P', status: 'undone', items: [] })).toContain(
      'UNDID proposal P. The simulation input is back to what it was before that change.'
    );
  });

  it('a partial approval names the lines left out as not applied (K3)', () => {
    const text = decisionToModelText({
      proposalId: 'P',
      status: 'approved',
      items: [{ label: 'Market cap', current: 'None', proposed: '0 kW' }],
      skipped: [{ label: 'Industry cap', current: 'None', proposed: '0 kW' }],
      patch: { sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 14, toHour: 24 }] },
    });
    expect(text).toContain('APPROVED proposal P');
    expect(text).toContain('"sector":"market"');
    expect(text).not.toContain('"sector":"industry"');
    expect(text).toContain('left out (NOT applied): Industry cap → 0 kW');
  });
});
