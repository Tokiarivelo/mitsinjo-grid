import { useState, useCallback, useRef, useEffect } from 'react';
import { useSimulationStore } from '@/stores';
import type {
  ChatMessageData,
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

/** Messages the API accepts: no error bubbles, no empty assistant turns (schema requires content ≥ 1). */
export function toPayloadMessages(messages: ChatMessageData[]) {
  return messages
    .filter((m) => m.role !== 'error' && m.content.trim().length > 0)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

export function useCopilot() {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [pending, setPending] = useState(false);
  const [toolActivity, setToolActivity] = useState<CopilotActivity | null>(null);
  const [error, setError] = useState<CopilotErrorKey | null>(null);
  const [pendingProposal, setPendingProposal] = useState<CopilotProposal | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');

  const abortRef = useRef<AbortController | null>(null);

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
        setAvailableModels(['muse-spark-1.3']);
        setSelectedModel('muse-spark-1.3');
      });
  }, []);

  const sendMessage = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || pending) return;

      const store = useSimulationStore.getState();
      const userMsgId = `user-${Date.now()}`;
      const assistantMsgId = `assistant-${Date.now() + 1}`;

      const userMessage: ChatMessageData = {
        id: userMsgId,
        role: 'user',
        content: trimmed,
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
            messages: payloadMessages,
            input: store.input,
            strategy: store.activeStrategy,
            model: selectedModel || undefined,
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
    [messages, pending, selectedModel]
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
