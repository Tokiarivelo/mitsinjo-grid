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
}

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant' | 'error';
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
  timestamp?: string;
}
