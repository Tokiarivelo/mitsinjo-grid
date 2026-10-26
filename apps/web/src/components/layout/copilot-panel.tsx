'use client';

import { useState, type KeyboardEvent } from 'react';
import { Send, Sparkles, X, Bot, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp?: string;
  evidence?: { label: string; value: string | number; unit?: string }[];
}

export interface CopilotPanelProps {
  open: boolean;
  onClose: () => void;
  messages?: CopilotMessage[];
  suggestedPrompts?: string[];
  pending?: boolean;
  error?: string;
  onSendMessage?: (content: string) => void;
  className?: string;
}

const DEFAULT_PROMPTS = [
  'Why did the health clinic lose power in this scenario?',
  'Compare proportional vs essential-first strategies.',
  'What happens if we double the battery capacity?',
  'How much energy was curtailed during peak sun hours?',
];

export function CopilotPanel({
  open,
  onClose,
  messages = [],
  suggestedPrompts = DEFAULT_PROMPTS,
  pending = false,
  error,
  onSendMessage,
  className,
}: CopilotPanelProps) {
  const [input, setInput] = useState('');
  const tCopilot = useTranslations('copilot');

  const handleSend = () => {
    if (!input.trim() || pending) return;
    onSendMessage?.(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Mobile/Tablet Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-canvas/70 backdrop-blur-xs xl:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-[360px] flex-col bg-surface border-l border-border shadow-2xl transition-transform duration-panel ease-in-out',
          'xl:static xl:shadow-none',
          className
        )}
      >
        {/* Header */}
        <div className="flex h-17 items-center justify-between px-4 border-b border-border bg-surface-elevated/40">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-control-sm bg-ai-violet/15 text-ai-violet">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-sm font-semibold text-text-primary">
                {tCopilot('title')}
              </span>
              <StatusBadge variant="ai" label={tCopilot('badge')} size="sm" />
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={tCopilot('close')}
            className="p-1.5 rounded-control text-text-muted hover:text-text-primary hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Message / Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-4 py-4">
              <div className="p-3.5 rounded-card bg-surface-elevated/50 border border-border flex items-start gap-3">
                <Bot className="h-5 w-5 text-ai-violet shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex flex-col gap-1 text-xs">
                  <span className="font-semibold text-text-primary">{tCopilot('assistantRole')}</span>
                  <p className="text-text-secondary leading-relaxed">
                    {tCopilot('assistantDesc')}
                  </p>
                </div>
              </div>

              {/* Suggested prompts */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-mono text-text-muted uppercase tracking-wider">
                  {tCopilot('suggestedQuestions')}
                </span>
                <div className="flex flex-col gap-1.5">
                  {suggestedPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onSendMessage?.(prompt)}
                      className="text-left text-xs p-2.5 rounded-control bg-surface-elevated/30 hover:bg-surface-hover border border-border/60 hover:border-border text-text-secondary hover:text-text-primary transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <span className="truncate pr-2">{prompt}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-text-muted group-hover:text-energy-cyan shrink-0" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'flex flex-col text-xs p-3 rounded-card border leading-relaxed',
                  m.role === 'user'
                    ? 'ml-6 bg-surface-elevated border-border text-text-primary'
                    : m.role === 'error'
                    ? 'bg-critical-red/10 border-critical-red/30 text-critical-red'
                    : 'mr-2 bg-surface-elevated/70 border-ai-violet/30 border-l-2 border-l-ai-violet text-text-primary'
                )}
              >
                {m.role === 'assistant' && (
                  <div className="flex items-center justify-between mb-1 text-[10px] text-ai-violet font-mono font-medium">
                    <span>{tCopilot('badge')}</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{m.content}</p>

                {/* Evidence table if provided */}
                {m.evidence && m.evidence.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-border/40 space-y-1">
                    <span className="text-[10px] font-mono text-text-muted uppercase">
                      {tCopilot('computedEvidence')}
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {m.evidence.map((ev, i) => (
                        <div key={i} className="p-1.5 rounded-control-sm bg-canvas border border-border font-mono text-[11px]">
                          <span className="text-text-muted block text-[10px]">{ev.label}</span>
                          <span className="text-energy-cyan font-medium">
                            {ev.value} {ev.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {pending && (
            <div className="flex items-center gap-2 text-xs font-mono text-ai-violet p-3 rounded-card bg-surface-elevated border border-ai-violet/30">
              <Sparkles className="h-4 w-4 animate-spin text-ai-violet" aria-hidden="true" />
              <span>{tCopilot('analyzing')}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-card bg-critical-red/10 border border-critical-red/30 text-xs text-critical-red">
              {error}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="p-3 border-t border-border bg-surface-elevated/20">
          <div className="relative flex flex-col gap-2">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={tCopilot('placeholder')}
              className="w-full resize-none p-2.5 text-xs font-sans text-text-primary bg-canvas border border-border rounded-control
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-canvas placeholder:text-text-muted"
            />
            <div className="flex items-center justify-between text-[11px] text-text-muted">
              <span>{tCopilot('shiftEnter')}</span>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSend}
                disabled={!input.trim() || pending}
                aria-label={tCopilot('send')}
                icon={<Send className="h-3 w-3" aria-hidden="true" />}
              >
                {tCopilot('send')}
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
