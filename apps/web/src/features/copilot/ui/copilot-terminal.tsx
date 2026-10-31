'use client';

import { useRef, useState } from 'react';
import { Plus, Sparkles, X } from 'lucide-react';
import { useAppLocale, useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { GlassPanel } from '@/components/ui/glass-panel';
import { EnsureCopilot, useSharedCopilot } from '../hooks/copilot-context';
import { useChatComposer } from '../hooks/use-chat-composer';
import { useStickToBottom } from '../hooks/use-stick-to-bottom';
import { useVoiceInput } from '../hooks/use-voice-input';
import type { ChatMediaItem } from '../types';
import { ChatComposer } from './chat-composer';
import { ChatMessageItem } from './chat-message-item';
import { ToolActivity } from './tool-activity';
import { ModelPicker } from './model-picker';
import { MediaLightboxModal, type ActiveMedia } from './media-lightbox-modal';
import { CanvasSketchDialog } from './canvas-sketch-dialog';

export interface CopilotTerminalProps {
  onClose: () => void;
  className?: string;
}

/**
 * Copilot as a glass terminal floating over the full-screen village (3D, topology, circuit).
 * Same conversation and features as the copilot tab: proposals, undo, retry, evidence, voice, files.
 */
export function CopilotTerminal(props: CopilotTerminalProps) {
  return (
    <EnsureCopilot>
      <TerminalView {...props} />
    </EnsureCopilot>
  );
}

function TerminalView({ onClose, className }: CopilotTerminalProps) {
  const t = useTranslations('features.copilot');
  const { locale } = useAppLocale();
  const {
    sessionId,
    messages,
    pending,
    toolActivity,
    error,
    decisions,
    sendMessage,
    newSession,
    approveProposal,
    rejectProposal,
    undoableProposalId,
    undoLastChange,
    retryableId,
    retryLastAnswer,
    availableModels,
    selectedModel,
    setSelectedModel,
  } = useSharedCopilot();

  const [isSketchOpen, setIsSketchOpen] = useState(false);
  const [lightbox, setLightbox] = useState<ActiveMedia | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const scroll = useStickToBottom(logRef, [messages, toolActivity, pending]);

  const send = (prompt: string, media?: ChatMediaItem[]) => {
    scroll.stick();
    sendMessage(prompt, media);
  };
  const composer = useChatComposer({ onSend: send, pending });
  const voice = useVoiceInput({ locale, sessionId, onText: composer.appendText });

  const last = messages.at(-1);
  const answerStarted = last?.role === 'assistant' && last.content.length > 0;

  return (
    <>
      <section
        aria-label={t('terminal.title')}
        className={cn(
          'absolute z-30 flex flex-col',
          'inset-x-3 bottom-3 h-[72%] md:inset-x-auto md:right-4 md:top-16 md:bottom-4 md:h-auto md:w-[440px]',
          className
        )}
      >
        <GlassPanel
          className="flex-1 min-h-0 flex flex-col"
          innerClassName="@container flex-1 min-h-0 flex flex-col"
        >
          {/* Title bar */}
          <header className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40">
            <span className="flex items-center gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-critical-red/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning-amber/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-battery-green/80" />
            </span>
            <h2 className="ml-1 flex-1 min-w-0 whitespace-nowrap font-mono text-xs font-semibold text-text-primary">
              {t('terminal.title')}
            </h2>
            <span className="hidden @[400px]:inline shrink-0 px-1.5 py-0.5 rounded border border-ai-violet/40 bg-ai-violet/10 text-[9px] font-mono text-ai-violet">
              {t('badge')}
            </span>
            <button
              type="button"
              onClick={newSession}
              disabled={pending}
              aria-label={t('newSession')}
              title={t('newSession')}
              className="min-h-10 min-w-10 flex items-center justify-center rounded-full text-text-secondary hover:text-text-primary hover:bg-surface/60 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('terminal.close')}
              title={t('terminal.close')}
              className="min-h-10 min-w-10 flex items-center justify-center rounded-full text-text-secondary hover:text-text-primary hover:bg-surface/60 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          {/* Status line: model choice (shared with the copilot tab) */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/30">
            <ModelPicker
              models={availableModels}
              value={selectedModel}
              onChange={setSelectedModel}
              disabled={pending}
              size="terminal"
            />
          </div>

          {toolActivity && <ToolActivity activity={toolActivity} />}

          {/* Session log */}
          <div
            ref={logRef}
            onScroll={scroll.onScroll}
            role="log"
            aria-live="polite"
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-4 font-mono text-xs"
          >
            {messages.length === 0 && (
              <p className="text-text-secondary leading-relaxed">
                <span className="text-battery-green" aria-hidden="true">
                  ❯{' '}
                </span>
                {t('terminal.welcome')}
              </p>
            )}

            {messages.map((m) =>
              m.role === 'user' ? (
                <p
                  key={m.id}
                  className="flex gap-2 text-[13px] text-text-primary leading-relaxed break-words"
                >
                  <span className="text-battery-green shrink-0" aria-hidden="true">
                    ❯
                  </span>
                  <span className="min-w-0">
                    {m.content}
                    {m.media && m.media.length > 0 && (
                      <span className="ml-2 text-text-muted">
                        {t('terminal.attachments', { count: m.media.length })}
                      </span>
                    )}
                  </span>
                </p>
              ) : (
                <ChatMessageItem
                  key={m.id}
                  message={m}
                  proposalDecision={m.proposal ? decisions[m.proposal.proposalId] : undefined}
                  onApproveProposal={approveProposal}
                  onRejectProposal={rejectProposal}
                  onRetry={m.id === retryableId ? retryLastAnswer : undefined}
                  onUndo={
                    m.decision?.status === 'approved' &&
                    m.decision.proposalId === undoableProposalId
                      ? undoLastChange
                      : undefined
                  }
                  onMediaClick={setLightbox}
                />
              )
            )}

            {pending && !toolActivity && !answerStarted && (
              <p role="status" className="flex items-center gap-2 text-ai-violet">
                <Sparkles className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                <span>{t('analyzing')}</span>
                <span className="h-3.5 w-1.5 bg-ai-violet animate-pulse" aria-hidden="true" />
              </p>
            )}

            {error && (
              <p role="alert" className="text-critical-red">
                {t('errorTitle')} — {t(error)}
              </p>
            )}
          </div>

          <div className="p-2 border-t border-border/40">
            <ChatComposer
              composer={composer}
              voice={voice}
              pending={pending}
              onOpenSketch={() => setIsSketchOpen(true)}
              variant="terminal"
            />
          </div>
        </GlassPanel>
      </section>

      {/* Outside the glass: a blurred parent would trap these full-screen dialogs. */}
      <MediaLightboxModal
        isOpen={Boolean(lightbox)}
        media={lightbox}
        onClose={() => setLightbox(null)}
      />
      <CanvasSketchDialog
        isOpen={isSketchOpen}
        onClose={() => setIsSketchOpen(false)}
        onAttach={composer.addMedia}
      />
    </>
  );
}
