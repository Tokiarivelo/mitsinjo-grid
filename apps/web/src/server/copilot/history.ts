import 'server-only';

import { COPILOT_HISTORY_LIMIT } from '@/features/copilot/utils/history';

/** Older assistant answers are cut to this many characters (their numbers stay in the session evidence). */
export const OLD_ANSWER_MAX_CHARS = 600;

const EARLIER_MEDIA_NOTE = '[media shared earlier, not re-sent]';

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  media?: Array<{ type: 'image' | 'video'; url: string; key?: string }>;
}

/**
 * Shrinks the chat history sent to the model each turn:
 * - keeps the last `COPILOT_HISTORY_LIMIT` messages;
 * - media only on the latest user message (older images would be re-billed every turn,
 *   and only that message routes to the vision model);
 * - older assistant answers cut to `OLD_ANSWER_MAX_CHARS`; the latest answer stays whole.
 */
export function compactHistory<T extends HistoryMessage>(messages: readonly T[]): T[] {
  const recent = messages.slice(-COPILOT_HISTORY_LIMIT);
  let lastUser = -1;
  let lastAssistant = -1;
  recent.forEach((m, i) => {
    if (m.role === 'user') lastUser = i;
    else lastAssistant = i;
  });

  return recent.map((m, i) => {
    let next: T = m;
    if (m.media && m.media.length > 0 && i !== lastUser) {
      const { media: _dropped, ...rest } = m;
      void _dropped;
      next = {
        ...rest,
        content: m.content ? `${m.content}\n${EARLIER_MEDIA_NOTE}` : EARLIER_MEDIA_NOTE,
      } as T;
    }
    if (
      m.role === 'assistant' &&
      i !== lastAssistant &&
      next.content.length > OLD_ANSWER_MAX_CHARS
    ) {
      next = { ...next, content: `${next.content.slice(0, OLD_ANSWER_MAX_CHARS).trimEnd()}…` };
    }
    return next;
  });
}
