import type { InputPatch, StrategyId } from '@mitsinjo/engine';

export interface CopilotEvidence {
  resultId: string;
  fields: Record<string, number | string>;
}

export interface CopilotProposal {
  proposalId: string;
  patch?: InputPatch;
  strategy?: StrategyId;
  reason: string;
}

export interface MessageSections {
  whatHappened?: string;
  computedEvidence?: string;
  whyItMatters?: string;
  exploreNext?: string;
}

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  sections?: MessageSections;
  evidence?: CopilotEvidence;
  proposal?: CopilotProposal;
  timestamp?: string;
}
