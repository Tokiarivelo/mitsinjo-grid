import { useState, useCallback, useRef, useEffect } from 'react';
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
} from '../types';
import { parseMessageSections } from '../utils/parse-sections';

class CopilotHttpError extends Error {
  constructor(readonly key: CopilotErrorKey) {
    super(key);
  }
}

/** Messages the API accepts: no error bubbles, no empty assistant turns. */
export function toPayloadMessages(messages: ChatMessageData[]) {
  return messages
    .filter(
      (m) => m.role !== 'error' && (m.content.trim().length > 0 || (m.media && m.media.length > 0))
    )
    .map((m) => {
      const item: {
        role: 'user' | 'assistant';
        content: string;
        media?: Array<{ type: 'image' | 'video'; url: string }>;
      } = {
        role: m.role as 'user' | 'assistant',
        content: m.content,
      };
      if (m.media && m.media.length > 0) {
        item.media = m.media.map((med) => ({ type: med.type, url: med.url }));
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
  const [pendingProposal, setPendingProposal] = useState<CopilotProposal | null>(null);
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
          setAvailableModels(data.models);
          if (data.activeModel) {
            setSelectedModel(data.activeModel);
          } else if (data.models[0]) {
            setSelectedModel(data.models[0]);
          }
        }
      })
      .catch(() => {
        setAvailableModels(['auto', 'muse-spark-1.3']);
        setSelectedModel('auto');
      });
  }, []);

  const sendMessage = useCallback(
    async (prompt: string, media?: ChatMediaItem[]) => {
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
                    return { ...item, url: upData.publicUrl };
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

      const updatedHistory = [...messages, userMessage];
      setMessages([...updatedHistory, assistantMessage]);
      setPending(true);
      setError(null);
      setToolActivity(null);

      abortRef.current?.abort();
      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const payloadMessages = toPayloadMessages(updatedHistory);

        const res = await fetch('/api/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            messages: payloadMessages,
            input: store.input,
            strategy: store.activeStrategy,
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
                setPendingProposal(collectedProposal);
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId ? { ...msg, proposal: collectedProposal } : msg
                  )
                );
                break;
              }
              case 'error': {
                setError(
                  dataObj.code === 'PROVIDER_FALLBACK' ? 'errorProviderFallback' : 'errorGeneric'
                );
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
    [messages, pending, selectedModel, sessionId, locale, fetchSessions]
  );

  const approveProposal = useCallback(() => {
    if (!pendingProposal) return;
    const store = useSimulationStore.getState();
    store.applyProposal(pendingProposal.patch, pendingProposal.strategy);
    setPendingProposal(null);
  }, [pendingProposal]);

  const rejectProposal = useCallback(() => {
    setPendingProposal(null);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setToolActivity(null);
    setPendingProposal(null);
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
    pendingProposal,
    availableModels,
    selectedModel,
    setSelectedModel,
    sendMessage,
    approveProposal,
    rejectProposal,
    clearMessages,
  };
}
