'use client';

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send, Sparkles, Bot, AlertTriangle } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCopilot } from '../hooks/use-copilot';
import { useSimulationStore } from '@/stores/simulation.store';
import { ChatMessageItem } from './chat-message-item';
import { ToolActivity } from './tool-activity';
import { SuggestedPrompts } from './suggested-prompts';
import { ContextPanel } from './context-panel';

export interface CopilotWorkspaceProps {
  mode?: 'full' | 'panel';
  className?: string;
}

export function CopilotWorkspace({ mode = 'full', className }: CopilotWorkspaceProps) {
  const tCopilot = useTranslations('features.copilot');
  const tCommon = useTranslations('common');

  const activeStrategy = useSimulationStore((s) => s.activeStrategy);
  const result = useSimulationStore((s) => s.results[s.activeStrategy]);

  const {
    messages,
    pending,
    toolActivity,
    error,
    availableModels,
    selectedModel,
    setSelectedModel,
    sendMessage,
    approveProposal,
    rejectProposal,
  } = useCopilot();

  const [input, setInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, toolActivity, pending]);

  const handleSend = () => {
    if (!input.trim() || pending) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isFull = mode === 'full';

  return (
    <div className={cn('flex-1 flex flex-col min-h-0', className)}>
      {/* Header Area */}
      {isFull && (
        <div className="px-6 lg:px-8 py-5 border-b border-border/70 bg-surface/80 backdrop-blur-md sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-ai-violet/10 border border-ai-violet/30 text-ai-violet">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-display font-semibold text-text-primary tracking-tight">
                  {tCopilot('title')}
                </h1>
                <StatusBadge variant="ai" label={tCopilot('badge')} size="sm" />
              </div>
              <p className="text-xs text-text-secondary mt-0.5">{tCopilot('subtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Meta Model Selector */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-elevated border border-border/70 text-xs font-mono">
              <span className="text-[10px] text-text-muted font-semibold uppercase">
                {tCopilot('modelSelectorLabel')}
              </span>
              {availableModels.length > 1 ? (
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  aria-label={tCopilot('modelSelectorLabel')}
                  className="bg-transparent text-energy-cyan font-medium border-none focus:outline-none cursor-pointer text-xs"
                >
                  {availableModels.map((m) => (
                    <option key={m} value={m} className="bg-surface text-text-primary">
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-energy-cyan font-medium text-xs">
                  {selectedModel || 'muse-spark-1.3'}
                </span>
              )}
            </div>

            <StatusBadge variant="simulated" label={tCommon('simulatedData')} size="sm" />
          </div>
        </div>
      )}

      {/* Main Two-Column Operational Deck */}
      <div
        className={cn(
          'flex-1 flex gap-6 p-4 lg:p-6 min-h-0',
          isFull ? 'flex-col xl:flex-row max-w-[1720px] w-full mx-auto' : 'flex-col'
        )}
      >
        {/* Left / Conversation Canvas */}
        <section
          aria-label={tCopilot('chatRegionAria')}
          className="flex-1 flex flex-col gap-4 min-w-0 min-h-0"
        >
          {/* Tool Activity Status Bar if executing */}
          {toolActivity && <ToolActivity activity={toolActivity} />}

          {/* Chat Stream Canvas */}
          <div
            ref={chatScrollRef}
            role="log"
            aria-live="polite"
            className="flex-1 overflow-y-auto space-y-5 pr-1.5 min-h-[300px]"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center max-w-lg mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-ai-violet/15 border border-ai-violet/40 flex items-center justify-center text-ai-violet mb-4 shadow-[0_0_20px_rgba(182,160,255,0.2)]">
                  <Bot className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="font-display text-base font-semibold text-text-primary">
                  {tCopilot('emptyGreeting')}
                </h2>
                <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                  {tCopilot('emptyDescription')}
                </p>

                <div className="w-full mt-6">
                  <SuggestedPrompts
                    onSelectPrompt={(p) => sendMessage(p)}
                    disabled={pending}
                    result={result}
                    activeStrategy={activeStrategy}
                  />
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <ChatMessageItem
                  key={m.id}
                  message={m}
                  onApproveProposal={approveProposal}
                  onRejectProposal={rejectProposal}
                />
              ))
            )}

            {/* In-stream Pending Indicator if no text yet and tool completed */}
            {pending && !toolActivity && (
              <div className="flex items-center gap-2 text-xs font-mono text-ai-violet p-3 rounded-card bg-surface-elevated/70 border border-ai-violet/30 max-w-md">
                <Sparkles className="h-4 w-4 animate-spin text-ai-violet" aria-hidden="true" />
                <span>{tCopilot('analyzing')}</span>
              </div>
            )}

            {/* Error banner if global error occurred */}
            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-critical-red/10 border border-critical-red/30 text-xs text-critical-red flex items-start gap-2.5"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold">{tCopilot('errorTitle')}</span>
                  <span>{tCopilot(error)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Suggested Prompts if chat has messages */}
          {messages.length > 0 && (
            <SuggestedPrompts
              onSelectPrompt={(p) => sendMessage(p)}
              disabled={pending}
              result={result}
              activeStrategy={activeStrategy}
            />
          )}

          {/* Query Input Dock */}
          <div className="p-3 rounded-xl bg-surface-elevated/60 border border-border shadow-md">
            <div className="relative flex flex-col gap-2">
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={tCopilot('inputPlaceholder')}
                disabled={pending}
                aria-label={tCopilot('inputAria')}
                className="w-full resize-none p-2.5 text-xs font-sans text-text-primary bg-surface border border-border rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-violet focus-visible:ring-offset-1 focus-visible:ring-offset-canvas placeholder:text-text-muted disabled:opacity-50"
              />
              <div className="flex items-center justify-between text-[11px] text-text-muted">
                <span>{tCopilot('shiftEnterHint')}</span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSend}
                  disabled={!input.trim() || pending}
                  aria-label={tCopilot('sendButton')}
                  icon={<Send className="h-3 w-3" aria-hidden="true" />}
                  className="bg-ai-violet hover:bg-ai-violet/90 text-surface font-semibold"
                >
                  {tCopilot('sendButton')}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Right / Context Column (Full view only) */}
        {isFull && <ContextPanel />}
      </div>
    </div>
  );
}
