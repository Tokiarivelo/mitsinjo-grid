import type { ChatMessageData, ProposalDecision } from '../types';

/** Decision taken on each proposal of the chat, by proposal id (latest decision wins). */
export function proposalDecisions(
  messages: readonly ChatMessageData[]
): Record<string, ProposalDecision> {
  const out: Record<string, ProposalDecision> = {};
  for (const m of messages) {
    if (m.role === 'decision' && m.decision) out[m.decision.proposalId] = m.decision;
  }
  return out;
}

/**
 * How the model sees an operator decision (sent as a user turn, English, never shown in the UI).
 * The patch is the one the operator saw; numbers in it are settings, not engine results.
 */
export function decisionToModelText(d: ProposalDecision): string {
  const change = JSON.stringify({
    ...(d.patch && { patch: d.patch }),
    ...(d.strategy && { strategy: d.strategy }),
  });
  if (d.status === 'approved') {
    return `[Operator decision] APPROVED proposal ${d.proposalId}. It is now applied to the simulation input. Change: ${change}`;
  }
  if (d.status === 'undone') {
    return `[Operator decision] UNDID proposal ${d.proposalId}. The simulation input is back to what it was before that change. Change removed: ${change}`;
  }
  return `[Operator decision] REJECTED proposal ${d.proposalId}. Nothing was changed. Change not applied: ${change}`;
}
