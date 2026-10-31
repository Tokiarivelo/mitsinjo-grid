import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSimulationStore } from '@/stores';
import { useAppLocale } from '@/lib/i18n';
import type {
  ChatMessageData,
  ChatMediaItem,
  ChatChartData,
  ChatSessionSummary,
  CopilotActivity,
  CopilotErrorKey,
  CopilotEvidence,
  CopilotProposal,
  FallbackReason,
  ProposalDecision,
  ProposalDecisionStatus,
  ProposalDiffItem,
} from '../types';
import { parseMessageSections } from '../utils/parse-sections';
import { COPILOT_PAYLOAD_MAX } from '../utils/history';
import { decisionToModelText, proposalDecisions } from '../utils/decisions';

class CopilotHttpError extends Error {
  constructor(readonly key: CopilotErrorKey) {
    super(key);
  }
}

const FALLBACK_REASONS: readonly FallbackReason[] = ['spend_cap', 'provider_error', 'timeout'];

/** Messages that count in the conversation sent to the model (no error bubbles, no empty turns). */
export function isPayloadMessage(m: ChatMessageData): boolean {
  if (m.role === 'error' || m.retried) return false;
  if (m.role === 'decision') return Boolean(m.decision);
  return m.content.trim().length > 0 || Boolean(m.media && m.media.length > 0);
}

/**
 * Request history: the valid messages not yet folded into the summary (`summarizedCount` of them
 * are), at most `COPILOT_PAYLOAD_MAX`. Operator decisions go as user turns the model can read.
 */
/**
 * Payload messages before the first one sent: those in the summary plus any beyond
 * `COPILOT_PAYLOAD_MAX` (sent to the server, which reports the new total after a compaction).
 */
export function payloadBaseCount(messages: ChatMessageData[], summarizedCount = 0): number {
  const unsent = messages.filter(isPayloadMessage).length - summarizedCount;
  return summarizedCount + Math.max(0, unsent - COPILOT_PAYLOAD_MAX);
}

export function toPayloadMessages(messages: ChatMessageData[], summarizedCount = 0) {
  return messages
    .filter(isPayloadMessage)
    .slice(summarizedCount)
    .slice(-COPILOT_PAYLOAD_MAX)
    .map((m) => {
      if (m.role === 'decision' && m.decision) {
        return { role: 'user' as const, content: decisionToModelText(m.decision) };
      }
      const item: {
        role: 'user' | 'assistant';
        content: string;
        media?: Array<{ type: 'image' | 'video'; url: string; key?: string }>;
      } = {
        role: m.role as 'user' | 'assistant',
        content: m.content,
      };
      if (m.media && m.media.length > 0) {
        item.media = m.media.map((med) => ({
          type: med.type,
          url: med.url,
          ...(med.key ? { key: med.key } : {}),
        }));
      }
      return item;
    });
}

export function useCopilot() {
  const { locale } = useAppLocale();
  const [sessionId, setSessionId] = useState<string>(() => `session-${Date.now()}`);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [pending, setPending] = useState(false);
  const [toolActivity, setToolActivity] = useState<CopilotActivity | null>(null);
  const [error, setError] = useState<CopilotErrorKey | null>(null);
  // Conversation summary (auto-compaction): text + how many payload messages it covers.
  const [summary, setSummary] = useState<string | undefined>(undefined);
  const [summarizedCount, setSummarizedCount] = useState(0);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('auto');

  const abortRef = useRef<AbortController | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/copilot/sessions');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.sessions)) {
          setSessions(data.sessions);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const loadSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/copilot/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          setSessionId(data.session.id);
          setMessages(data.session.messages || []);
          setSummary(data.session.summary || undefined);
          setSummarizedCount(data.session.summarizedCount ?? 0);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const newSession = useCallback(() => {
    const newId = `session-${Date.now()}`;
    setSessionId(newId);
    setMessages([]);
    setError(null);
    setSummary(undefined);
    setSummarizedCount(0);
  }, []);

  const removeSession = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/copilot/sessions/${id}`, { method: 'DELETE' });
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (sessionId === id) {
          newSession();
        }
      } catch {
        // ignore
      }
    },
    [sessionId, newSession]
  );

  useEffect(() => {
    let ignore = false;
    async function loadSessions() {
      try {
        const res = await fetch('/api/copilot/sessions');
        if (res.ok && !ignore) {
          const data = await res.json();
          if (Array.isArray(data.sessions)) {
            setSessions(data.sessions);
          }
        }
      } catch {
        // ignore
      }
    }
    void loadSessions();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    fetch('/api/copilot/models')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.models)) {
          // Auto (adaptive routing) is always offered and always the default choice.
          const models: string[] = data.models.includes('auto')
            ? data.models
            : ['auto', ...data.models];
          setAvailableModels(models);
          setSelectedModel('auto');
        }
      })
      .catch(() => {
        setAvailableModels(['auto', 'muse-spark-1.3']);
        setSelectedModel('auto');
      });
  }, []);

  const sendMessage = useCallback(
    async (prompt: string, media?: ChatMediaItem[], options?: { retryOf?: string }) => {
      // Retry: same question again, no new user bubble; the old answer stays but leaves the payload.
      const retryOf = options?.retryOf;
      const trimmed = prompt.trim();
      const hasMedia = Boolean(media && media.length > 0);
      if ((!trimmed && !hasMedia) || pending) return;

      // Pre-upload any base64 data URLs to Cloudflare R2
      let finalMedia = media;
      if (media && media.some((m) => m.url.startsWith('data:'))) {
        try {
          finalMedia = await Promise.all(
            media.map(async (item) => {
              if (item.url.startsWith('data:')) {
                const upRes = await fetch('/api/copilot/upload', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'upload_data_url',
                    dataUrl: item.url,
                    filename: item.name,
                  }),
                });
                if (upRes.ok) {
                  const upData = await upRes.json();
                  if (upData.publicUrl) {
                    // Key kept only when stored in R2, so a reopened session re-signs the link.
                    const key = upData.configured ? upData.fileKey : undefined;
                    return { ...item, url: upData.publicUrl, ...(key ? { key } : {}) };
                  }
                }
              }
              return item;
            })
          );
        } catch {
          // fallback to local data url
        }
      }

      const store = useSimulationStore.getState();
      const userMsgId = `user-${Date.now()}`;
      const assistantMsgId = `assistant-${Date.now() + 1}`;

      const userMessage: ChatMessageData = {
        id: userMsgId,
        role: 'user',
        content: trimmed,
        media: hasMedia ? finalMedia : undefined,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };

      const assistantMessage: ChatMessageData = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };

      const updatedHistory = retryOf
        ? messages.map((m) => (m.id === retryOf ? { ...m, retried: true } : m))
        : [...messages, userMessage];
      setMessages([...updatedHistory, assistantMessage]);
      setPending(true);
      setError(null);
      setToolActivity(null);

      abortRef.current?.abort();
      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const payloadMessages = toPayloadMessages(updatedHistory, summarizedCount);
        const baseCount = payloadBaseCount(updatedHistory, summarizedCount);

        const res = await fetch('/api/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            messages: payloadMessages,
            input: store.input,
            strategy: store.activeStrategy,
            hour: store.timeIndex,
            ...(retryOf && { retry: true }),
            ...(summary && { summary }),
            ...(baseCount > 0 && { summarizedCount: baseCount }),
            model: selectedModel || undefined,
            locale,
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          throw new CopilotHttpError(res.status === 429 ? 'errorRateLimited' : 'errorGeneric');
        }

        if (!res.body) {
          throw new CopilotHttpError('errorGeneric');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let streamedContent = '';
        let collectedEvidence: CopilotEvidence[] = [];
        let collectedProposal: CopilotProposal | undefined;
        let collectedImageUrl: string | undefined;
        let collectedImageCaption: string | undefined;
        let collectedVideoUrl: string | undefined;
        let collectedVideoCaption: string | undefined;
        let collectedChart: ChatChartData | undefined;
        let detectedModelName: string | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const lines = part.split('\n');
            let event = '';
            let dataStr = '';

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                event = line.replace('event: ', '').trim();
              } else if (line.startsWith('data: ')) {
                dataStr = line.replace('data: ', '').trim();
              }
            }

            if (!event || !dataStr) continue;

            let dataObj: Record<string, unknown> = {};
            try {
              dataObj = JSON.parse(dataStr);
            } catch {
              dataObj = {};
            }

            switch (event) {
              case 'model': {
                detectedModelName = (dataObj.model as string) || undefined;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId ? { ...msg, detectedModel: detectedModelName } : msg
                  )
                );
                break;
              }
              case 'image': {
                collectedImageUrl = (dataObj.imageUrl as string) || undefined;
                collectedImageCaption = (dataObj.caption as string) || undefined;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          imageUrl: collectedImageUrl,
                          imageCaption: collectedImageCaption,
                        }
                      : msg
                  )
                );
                break;
              }
              case 'video': {
                collectedVideoUrl = (dataObj.videoUrl as string) || undefined;
                collectedVideoCaption = (dataObj.caption as string) || undefined;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          videoUrl: collectedVideoUrl,
                          videoCaption: collectedVideoCaption,
                        }
                      : msg
                  )
                );
                break;
              }
              case 'chart': {
                collectedChart = dataObj as unknown as ChatChartData;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          chart: collectedChart,
                        }
                      : msg
                  )
                );
                break;
              }
              case 'activity': {
                const tool = typeof dataObj.tool === 'string' ? dataObj.tool : 'start';
                const sector = typeof dataObj.sector === 'string' ? dataObj.sector : undefined;
                setToolActivity({ tool, sector });
                break;
              }
              case 'delta': {
                const text = (dataObj.text as string) || '';
                streamedContent += text;
                const sections = parseMessageSections(streamedContent);

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          content: streamedContent,
                          sections,
                          evidence: collectedEvidence,
                          proposal: collectedProposal,
                          imageUrl: collectedImageUrl,
                          imageCaption: collectedImageCaption,
                          videoUrl: collectedVideoUrl,
                          videoCaption: collectedVideoCaption,
                          chart: collectedChart,
                          detectedModel: detectedModelName,
                        }
                      : msg
                  )
                );
                break;
              }
              case 'evidence': {
                collectedEvidence = [...collectedEvidence, dataObj as unknown as CopilotEvidence];
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId ? { ...msg, evidence: collectedEvidence } : msg
                  )
                );
                break;
              }
              case 'proposal': {
                collectedProposal = dataObj as unknown as CopilotProposal;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId ? { ...msg, proposal: collectedProposal } : msg
                  )
                );
                break;
              }
              case 'summary': {
                // Older turns were folded into the summary: send only the newer ones next time.
                if (
                  typeof dataObj.text === 'string' &&
                  typeof dataObj.summarizedCount === 'number'
                ) {
                  setSummary(dataObj.text);
                  setSummarizedCount(dataObj.summarizedCount);
                }
                break;
              }
              case 'error': {
                if (dataObj.code === 'PROVIDER_FALLBACK') {
                  // The answer still arrives (offline copilot): a note on it, not a red alert.
                  const reason = FALLBACK_REASONS.find((r) => r === dataObj.reason) ?? 'unknown';
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId ? { ...msg, fallbackReason: reason } : msg
                    )
                  );
                } else {
                  setError('errorGeneric');
                }
                break;
              }
              case 'done': {
                setToolActivity(null);
                fetchSessions();
                break;
              }
            }
          }
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return;
        const errorKey: CopilotErrorKey =
          err instanceof CopilotHttpError ? err.key : 'errorGeneric';
        setError(errorKey);

        // Keep assistant message or show error message
        setMessages((prev) => {
          const hasAssistant = prev.some((m) => m.id === assistantMsgId && m.content.length > 0);
          if (hasAssistant) return prev;
          return prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  role: 'error' as const,
                  content: '',
                  errorKey,
                }
              : m
          );
        });
      } finally {
        setPending(false);
        setToolActivity(null);
      }
    },
    [messages, pending, selectedModel, sessionId, locale, fetchSessions, summary, summarizedCount]
  );

  const decisions = useMemo(() => proposalDecisions(messages), [messages]);

  /** Last answer (or error) can be redone while nothing is pending and a question precedes it. */
  const lastMessage = messages.at(-1);
  const retryableId =
    !pending &&
    lastMessage &&
    (lastMessage.role === 'assistant' || lastMessage.role === 'error') &&
    !lastMessage.retried &&
    messages.some((m) => m.role === 'user')
      ? lastMessage.id
      : null;

  /** Asks the last question again, telling the model the previous answer did not help. */
  const retryLastAnswer = useCallback(() => {
    if (!retryableId) return;
    const question = messages.findLast((m) => m.role === 'user');
    if (!question) return;
    void sendMessage(question.content, question.media, { retryOf: retryableId });
  }, [messages, retryableId, sendMessage]);

  /** Posts an operator decision in the chat and saves it with the session (keeps the card locked on reopen). */
  const postDecision = useCallback(
    (decision: ProposalDecision) => {
      const decisionMessage: ChatMessageData = {
        id: `decision-${decision.proposalId}-${decision.status}-${Date.now()}`,
        role: 'decision',
        content: '',
        decision,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, decisionMessage]);
      void fetch(`/api/copilot/sessions/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decisionMessage),
      }).catch(() => {});
    },
    [sessionId]
  );

  /** Applies (or not) this message's own proposal, once, and posts the decision in the chat. */
  const decideProposal = useCallback(
    (status: ProposalDecisionStatus, message: ChatMessageData, items: ProposalDiffItem[]) => {
      const proposal = message.proposal;
      if (!proposal || decisions[proposal.proposalId]) return;
      if (status === 'approved') {
        const sim = useSimulationStore.getState();
        sim.approveChange(proposal.proposalId, proposal.patch, proposal.strategy);
        if (useSimulationStore.getState().status !== 'complete') return;
      }
      postDecision({
        proposalId: proposal.proposalId,
        status,
        items,
        ...(proposal.patch && { patch: proposal.patch }),
        ...(proposal.strategy && { strategy: proposal.strategy }),
      });
    },
    [decisions, postDecision]
  );

  /** Last approved change still in the store history: the one "Undo" restores. */
  const lastChangeId = useSimulationStore((s) => s.changeHistory[s.changeHistory.length - 1]?.id);
  const undoableProposalId =
    lastChangeId && decisions[lastChangeId]?.status === 'approved' ? lastChangeId : null;

  /** Undoes the last approved change (store restores the input) and posts it in the chat. */
  const undoLastChange = useCallback(() => {
    if (!undoableProposalId) return;
    const approved = decisions[undoableProposalId];
    const undoneId = useSimulationStore.getState().undoLastChange();
    if (!approved || undoneId !== undoableProposalId) return;
    postDecision({ ...approved, status: 'undone' });
  }, [decisions, postDecision, undoableProposalId]);

  const approveProposal = useCallback(
    (message: ChatMessageData, items: ProposalDiffItem[]) =>
      decideProposal('approved', message, items),
    [decideProposal]
  );

  const rejectProposal = useCallback(
    (message: ChatMessageData, items: ProposalDiffItem[]) =>
      decideProposal('rejected', message, items),
    [decideProposal]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setToolActivity(null);
    setSummary(undefined);
    setSummarizedCount(0);
  }, []);

  return {
    sessionId,
    sessions,
    fetchSessions,
    loadSession,
    newSession,
    removeSession,
    messages,
    pending,
    toolActivity,
    error,
    decisions,
    availableModels,
    selectedModel,
    setSelectedModel,
    sendMessage,
    approveProposal,
    rejectProposal,
    undoableProposalId,
    undoLastChange,
    retryableId,
    retryLastAnswer,
    clearMessages,
  };
}
