import type { ChangeImpact, InputPatch, StrategyId } from '@mitsinjo/engine';

export interface CopilotEvidence {
  resultId: string;
  fields: Record<string, number | string>;
}

export interface CopilotProposal {
  proposalId: string;
  patch?: InputPatch;
  strategy?: StrategyId;
  reason: string;
  /** Engine before/after, computed server-side (absent on proposals saved before M1-T1). */
  impact?: ChangeImpact;
}

/** Tool activity shown while the copilot works; translated in the UI. */
export interface CopilotActivity {
  tool: string; // 'start' | tool name
  sector?: string;
}

/** i18n keys under `features.copilot` for copilot errors (raw server text is never shown). */
export type CopilotErrorKey = 'errorProviderFallback' | 'errorRateLimited' | 'errorGeneric';

/** Why an answer came from the offline (deterministic) copilot; `unknown` when the server gave no reason. */
export type FallbackReason = 'spend_cap' | 'provider_error' | 'timeout' | 'unknown';

/** One changed setting of a proposal: label, value before, value proposed (already translated). */
export interface ProposalDiffItem {
  label: string;
  current: string;
  proposed: string;
}

/** `undone` = an approved change the operator later undid (K4); the input is back to before it. */
export type ProposalDecisionStatus = 'approved' | 'rejected' | 'undone';

/** Operator decision on a proposal, posted in the chat and sent to the model as context. */
export interface ProposalDecision {
  proposalId: string;
  status: ProposalDecisionStatus;
  /** Settings as shown when the operator decided (snapshot: the simulation changes after approval). */
  items: ProposalDiffItem[];
  patch?: InputPatch;
  strategy?: StrategyId;
}

export interface MessageSections {
  whatHappened?: string;
  computedEvidence?: string;
  whyItMatters?: string;
  exploreNext?: string;
}

export interface ChatMediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  name?: string;
  caption?: string;
  size?: number;
  /** R2 object key: the URL is re-signed from it when a saved session is reopened. */
  key?: string;
  /** Image drawn by the copilot (shown in the AI image block, not as an attachment). */
  generated?: boolean;
}

export interface ChatChartSeries {
  key: string;
  label: string;
  color?: string;
}

export interface ChatChartData {
  type: 'line' | 'bar' | 'area';
  title?: string;
  subtitle?: string;
  xAxisKey?: string;
  series: ChatChartSeries[];
  data: Array<Record<string, string | number>>;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  locale?: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export interface ChatSessionDetail extends ChatSessionSummary {
  messages: ChatMessageData[];
  /** Conversation summary (auto-compaction) and how many payload messages it covers. */
  summary?: string;
  summarizedCount?: number;
}

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant' | 'error' | 'decision';
  content: string;
  sections?: MessageSections;
  evidence?: CopilotEvidence[]; // one entry per tool result, in call order
  proposal?: CopilotProposal;
  imageUrl?: string;
  imageCaption?: string;
  videoUrl?: string;
  videoCaption?: string;
  media?: ChatMediaItem[];
  chart?: ChatChartData;
  detectedModel?: string;
  errorKey?: CopilotErrorKey;
  /** Set when this answer fell back to the offline copilot. */
  fallbackReason?: FallbackReason;
  /** Only on `role: 'decision'`. */
  decision?: ProposalDecision;
  /** Answer the operator asked to redo (Retry): kept on screen, no longer sent to the model. */
  retried?: boolean;
  timestamp?: string;
}
