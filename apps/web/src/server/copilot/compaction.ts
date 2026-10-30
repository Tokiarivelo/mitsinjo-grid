import 'server-only';

import { estimateTokens } from '@/server/spend';
import type { LlmProvider } from './provider';
import { compactHistory, type HistoryMessage } from './history';

/** Above this estimated history size (tokens, after `compactHistory`), older turns are summarized. */
export const COMPACT_TOKEN_LIMIT = 6_000;
/**
 * Also compact past this many messages, so nothing reaches the client's `COPILOT_PAYLOAD_MAX`
 * and gets dropped unsummarized.
 */
export const COMPACT_MAX_MESSAGES = 24;
/** Messages always kept word for word after a compaction. */
export const KEEP_RECENT = 6;
/** Longest summary kept (characters); older lines go first. */
export const SUMMARY_MAX_CHARS = 1_500;

const NUMBER_WITH_UNIT = /\d+(?:[.,]\d+)?\s*(?:kWh|kW|W|%)/gi;
const NUMBER_PLACEHOLDER = '[number: ask a tool]';

/** Removes energy figures (kW, kWh, W, %): a summary is never evidence, the engine is. */
export function scrubNumbers(text: string): string {
  return text.replace(NUMBER_WITH_UNIT, NUMBER_PLACEHOLDER);
}

/** Keeps the summary short: drops whole lines from the top until it fits. */
export function capSummary(text: string, max = SUMMARY_MAX_CHARS): string {
  const lines = text.trim().split('\n');
  while (lines.length > 1 && lines.join('\n').length > max) lines.shift();
  const out = lines.join('\n');
  return out.length > max ? out.slice(out.length - max) : out;
}

export interface CompactionPlan<T> {
  /** Oldest messages, to fold into the summary. */
  fold: T[];
  /** Newest messages, sent as they are. */
  keep: T[];
}

/** Splits the history when it is over the token or message limit; `null` = send it as it is. */
export function planCompaction<T extends HistoryMessage>(
  messages: readonly T[],
  limit = COMPACT_TOKEN_LIMIT
): CompactionPlan<T> | null {
  if (messages.length <= KEEP_RECENT) return null;
  const tokens = estimateTokens(JSON.stringify(compactHistory(messages, Infinity)));
  if (tokens <= limit && messages.length <= COMPACT_MAX_MESSAGES) return null;
  return { fold: messages.slice(0, -KEEP_RECENT), keep: messages.slice(-KEEP_RECENT) };
}

function transcript(messages: readonly HistoryMessage[]): string {
  return messages
    .map((m) => `${m.role === 'user' ? 'Operator' : 'Copilot'}: ${m.content.slice(0, 600)}`)
    .join('\n');
}

/** Offline summary (mock provider, tests): one line per operator turn. */
function deterministicSummary(previous: string | undefined, fold: readonly HistoryMessage[]) {
  const lines = fold
    .filter((m) => m.role === 'user' && m.content.trim())
    .map((m) => `- Operator: ${m.content.trim().replace(/\s+/g, ' ').slice(0, 160)}`);
  return [previous?.trim(), ...lines].filter(Boolean).join('\n');
}

const SUMMARIZER_PROMPT = `You summarize a conversation between a solar microgrid operator and an AI copilot (simulated data).
Write at most 8 short bullet lines ("- "): what the operator asked, proposals made and the operator's decisions (approved / rejected), open questions.
Never write energy numbers (kW, kWh, %): they must be recomputed by tools. Keep sector and strategy names. Same language as the conversation.
Start from the previous summary when there is one and fold the new turns into it. Output only the bullets.`;

/**
 * Folds `fold` into `previous` with the chat model (no tools). Mock provider → deterministic lines.
 * Numbers with energy units are always removed, whatever the model wrote. Throws on provider failure.
 */
export async function summarizeTurns(
  provider: LlmProvider,
  previous: string | undefined,
  fold: readonly HistoryMessage[],
  signal?: AbortSignal
): Promise<string> {
  let text: string;
  if (provider.name === 'mock') {
    text = deterministicSummary(previous, fold);
  } else {
    const turn = await provider.chat(
      [
        { role: 'system', content: SUMMARIZER_PROMPT },
        {
          role: 'user',
          content: `Previous summary:\n${previous?.trim() || '(none)'}\n\nNew turns:\n${transcript(fold)}`,
        },
      ],
      [],
      signal
    );
    text = turn.content?.trim() ?? '';
    if (!text) throw new Error('Empty summary');
  }
  return capSummary(scrubNumbers(text));
}

/** System message that carries the summary to the chat model. */
export function summaryNote(summary: string): string {
  return `Conversation so far (summary of earlier turns; numbers are not evidence, call tools for any value):\n${summary}`;
}
