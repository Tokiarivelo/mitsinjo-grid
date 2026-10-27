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

/** Tool activity shown while the copilot works; translated in the UI. */
export interface CopilotActivity {
  tool: string; // 'start' | tool name
  sector?: string;
}

/** i18n keys under `features.copilot` for copilot errors (raw server text is never shown). */
export type CopilotErrorKey = 'errorProviderFallback' | 'errorRateLimited' | 'errorGeneric';

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
  evidence?: CopilotEvidence[]; // one entry per tool result, in call order
  proposal?: CopilotProposal;
  errorKey?: CopilotErrorKey;
  timestamp?: string;
}
