import type { ChangeImpact, InputPatch, SectorId, StrategyId } from '@mitsinjo/engine';
// Type-only: this module runs in client components, never the server barrel.
import type { MeetingPriority } from '@/lib/meeting-priorities';
import type { Observation } from '@/server/perception/schemas';
import type { ScenarioDraftPayload, ScenarioDraftPreview } from '@/lib/scenario-draft';

export type { ScenarioDraftPayload, ScenarioDraftPreview };

export interface CopilotEvidence {
  resultId: string;
  fields: Record<string, number | string>;
}

/** One instance of a `segment` perception result: pixel box + optional 0–1 outline. */
export interface CopilotSegmentInstance {
  box: { x1: number; y1: number; x2: number; y2: number };
  confidence?: number;
  /** Simplified SVG path in image fractions (≤ 160 points), when the mask decoded. */
  outline?: string;
}

/** One vision result streamed on the `perception` SSE event (M4-T2): AI observation, to verify. */
export interface CopilotPerception {
  kind: string; // 'analyze' | 'segment'
  summary?: string;
  observations?: Observation[];
  concept?: string;
  count?: number;
  /** Photo the vision ran on (`segment`: lightbox overlay target, M8-T1). */
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  instances?: CopilotSegmentInstance[];
  boxCoverage?: number;
  model: string;
  source: string;
}

/** One diarized turn + the extracted social priorities of a village meeting (M10-T4). */
export interface CopilotMeetingTurn {
  speaker?: string;
  text: string;
  startMs: number;
  endMs: number;
}

export interface CopilotMeeting {
  turns: CopilotMeetingTurn[];
  priorities: MeetingPriority[];
  /** Proposed patch (priorities + never-cut floors); proposed through the usual dialog. */
  patch: InputPatch;
  unmapped: { quote: string; reason: string }[];
  source: string;
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
  /** Line id (`proposalPartIds`): checkbox key for partial approval. Absent on decisions saved before K3. */
  id?: string;
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
  /** Lines the operator unchecked (K3): shown, never applied. */
  skipped?: ProposalDiffItem[];
  /** What was applied (the checked part when lines were skipped). */
  patch?: InputPatch;
  strategy?: StrategyId;
}

export interface MessageSections {
  whatHappened?: string;
  computedEvidence?: string;
  whyItMatters?: string;
  exploreNext?: string;
}

/** One cut window on the `media` SSE event (M5-T1): engine hours for the HTML overlay. */
export interface CopilotVisualCut {
  sector: SectorId;
  fromHour: number;
  toHour: number;
  unservedKwh: number;
}

/** One voice of the sector council (M7-T1): a patch, already engine-simulated. */
export interface CopilotCouncilAgent {
  sector: SectorId;
  reason: string;
  patch: InputPatch;
  impact: ChangeImpact;
  mock: boolean;
}

/** The mediator's recommendation (Wonder when paid, lowest-unserved rule when mock). */
export interface CopilotCouncilVerdict {
  pick: SectorId;
  synthesis: string;
  mock: boolean;
}

/** A council run streamed on the `council` SSE event (M7-T1). */
export interface CopilotCouncil {
  question: string;
  rounds: number;
  agents: CopilotCouncilAgent[];
  verdict: CopilotCouncilVerdict;
}

/** Image drawn from an engine result (`generate_visual`, M5-T1): picture + engine overlay. */
export interface CopilotVisualPanel {
  hour: number;
  sky: 'night' | 'sunny' | 'partly_cloudy' | 'overcast';
  cuts: boolean;
}

export interface CopilotVisual {
  kind: 'village_tonight' | 'shedding_poster' | 'day_comic';
  imageUrl: string;
  caption?: string;
  overlay: { cuts: CopilotVisualCut[]; panels?: CopilotVisualPanel[] } | null;
  resultId: string;
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
  perception?: CopilotPerception[]; // one entry per vision result, in call order
  /** Diarized village meeting (M10-T4): turns + priorities, proposed on the operator's tap. */
  meeting?: CopilotMeeting;
  proposal?: CopilotProposal;
  imageUrl?: string;
  imageCaption?: string;
  videoUrl?: string;
  videoCaption?: string;
  /** Visual drawn from an engine result (M5-T2): shown as a card with an AI badge. */
  visual?: CopilotVisual;
  /** Sector council run (M7-T1): shown as bubbles with engine-number badges. */
  council?: CopilotCouncil;
  media?: ChatMediaItem[];
  chart?: ChatChartData;
  detectedModel?: string;
  errorKey?: CopilotErrorKey;
  /** Set when this answer fell back to the offline copilot. */
  fallbackReason?: FallbackReason;
  /** Only on `role: 'decision'`. */
  decision?: ProposalDecision;
  /** Playback command the copilot ran (time cursor only), shown as a small line on the answer. */
  control?: PlaybackControl;
  /** Multi-day scenario draft card (PA-T8e). */
  scenarioDraft?: ScenarioDraftPayload;
  /** Answer the operator asked to redo (Retry): kept on screen, no longer sent to the model. */
  retried?: boolean;
  timestamp?: string;
}

/** `control_playback` tool → client: playback or time cursor only, never the scenario inputs. */
export interface PlaybackControl {
  action: 'play' | 'pause' | 'stop' | 'restart' | 'seek';
  hour?: number;
}
