'use client';

import { useState, useRef } from 'react';
import { Sparkles, Bot, AlertTriangle, X, History, Plus, Trash2 } from 'lucide-react';
import { useAppLocale, useTranslations } from '@/lib/i18n';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EnsureCopilot, useSharedCopilot } from '../hooks/copilot-context';
import { useChatComposer } from '../hooks/use-chat-composer';
import { useStickToBottom } from '../hooks/use-stick-to-bottom';
import { ChatComposer } from './chat-composer';
import { ModelPicker } from './model-picker';
import { useVoiceInput } from '../hooks/use-voice-input';
import { useSimulationStore } from '@/stores/simulation.store';
import type { ChatMediaItem } from '../types';
import { ChatMessageItem } from './chat-message-item';
import { ToolActivity } from './tool-activity';
import { SuggestedPrompts } from './suggested-prompts';
import { ContextPanel } from './context-panel';
import { MediaLightboxModal, type ActiveMedia } from './media-lightbox-modal';
import { CanvasSketchDialog } from './canvas-sketch-dialog';

export interface CopilotWorkspaceProps {
  mode?: 'full' | 'panel';
  className?: string;
}

/** Copilot chat (page or panel). Joins the shared conversation when a `CopilotProvider` is above. */
export function CopilotWorkspace(props: CopilotWorkspaceProps) {
  return (
    <EnsureCopilot>
      <WorkspaceView {...props} />
    </EnsureCopilot>
  );
}

function WorkspaceView({ mode = 'full', className }: CopilotWorkspaceProps) {
  const tCopilot = useTranslations('features.copilot');
  const tCommon = useTranslations('common');

  const activeStrategy = useSimulationStore((s) => s.activeStrategy);
  const result = useSimulationStore((s) => s.results[s.activeStrategy]);

  const {
    sessionId,
    sessions,
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
  } = useSharedCopilot();

  const [activeLightboxMedia, setActiveLightboxMedia] = useState<ActiveMedia | null>(null);
  const [isSketchOpen, setIsSketchOpen] = useState(false);
  const [showSessionsDrawer, setShowSessionsDrawer] = useState(false);

  const { locale } = useAppLocale();
  const lastMessage = messages.at(-1);
  const answerStarted = lastMessage?.role === 'assistant' && lastMessage.content.length > 0;
  const chatRef = useRef<HTMLDivElement>(null);
  const chatScroll = useStickToBottom(chatRef, [messages, toolActivity, pending]);

  const send = (prompt: string, media?: ChatMediaItem[]) => {
    chatScroll.stick();
    sendMessage(prompt, media);
  };
  const composer = useChatComposer({ onSend: send, pending });
  const voice = useVoiceInput({ locale, sessionId, onText: composer.appendText });

  const isFull = mode === 'full';

  return (
    // Wide /copilot: the workspace fills the main area so the chat scrolls inside it.
    <div className={cn('flex-1 flex flex-col min-h-0', isFull && 'xl:h-full', className)}>
      {/* Header Area (Full Mode) */}
      {isFull ? (
        <div className="px-4 sm:px-6 lg:px-8 py-3.5 sm:py-5 border-b border-border/70 bg-surface/80 backdrop-blur-md sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
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
            {/* Session Management Buttons */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={newSession}
                icon={<Plus className="h-3 w-3" />}
                className="h-7 text-[11px] px-2.5"
                title={tCopilot('newSession')}
              >
                {tCopilot('newSession')}
              </Button>
              <button
                type="button"
                onClick={() => setShowSessionsDrawer((v) => !v)}
                aria-label={tCopilot('chatSessions')}
                title={tCopilot('chatSessions')}
                className={cn(
                  'p-1.5 rounded-md border text-xs transition-colors cursor-pointer flex items-center gap-1 font-mono text-[11px]',
                  showSessionsDrawer
                    ? 'bg-ai-violet/20 border-ai-violet text-ai-violet'
                    : 'bg-surface-elevated border-border text-text-secondary hover:text-text-primary'
                )}
              >
                <History className="h-3.5 w-3.5" />
                <span>{sessions.length}</span>
              </button>
            </div>

            <ModelPicker
              models={availableModels}
              value={selectedModel}
              onChange={setSelectedModel}
            />

            <StatusBadge variant="simulated" label={tCommon('simulatedData')} size="sm" />
          </div>
        </div>
      ) : (
        /* Header Area (Panel Mode on Simulation Page) */
        <div className="px-3 py-2.5 border-b border-border/60 bg-surface/70 rounded-t-lg flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 rounded bg-ai-violet/10 text-ai-violet shrink-0">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <span className="text-xs font-semibold text-text-primary truncate">
              {tCopilot('title')}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <ModelPicker
              models={availableModels}
              value={selectedModel}
              onChange={setSelectedModel}
              size="sm"
            />

            <StatusBadge variant="simulated" label={tCommon('simulatedData')} size="sm" />
          </div>
        </div>
      )}

      {/* Saved Sessions Drawer */}
      {showSessionsDrawer && (
        <div className="px-4 py-3 bg-surface-elevated/95 border-b border-border shadow-md animate-in slide-in-from-top-2 duration-150">
          <div className="max-w-[1720px] mx-auto">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-ai-violet" />
                <span className="text-xs font-semibold text-text-primary">
                  {tCopilot('sessionHistory')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowSessionsDrawer(false)}
                aria-label={tCopilot('closeSessions')}
                className="min-h-10 min-w-10 flex items-center justify-center rounded text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {sessions.length === 0 ? (
              <p className="text-xs text-text-muted py-2">{tCopilot('noSessions')}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-lg border text-xs transition-all cursor-pointer group',
                      s.id === sessionId
                        ? 'border-energy-cyan bg-energy-cyan/10 text-energy-cyan'
                        : 'border-border/70 bg-surface hover:border-border text-text-primary'
                    )}
                    onClick={() => {
                      loadSession(s.id);
                      setShowSessionsDrawer(false);
                    }}
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-medium truncate block text-[11px]">{s.title}</span>
                      <span className="text-[9px] font-mono text-text-muted">
                        {new Date(s.updatedAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSession(s.id);
                      }}
                      aria-label={tCopilot('deleteSession')}
                      className="min-h-10 min-w-10 flex items-center justify-center rounded md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 text-text-muted hover:text-critical-red transition-opacity cursor-pointer shrink-0"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Two-Column Operational Deck */}
      <div
        className={cn(
          'flex-1 flex gap-6 p-3 sm:p-4 lg:p-6 min-h-0',
          isFull ? 'flex-col xl:flex-row max-w-[1720px] w-full mx-auto' : 'flex-col'
        )}
      >
        {/* Left / Conversation Canvas */}
        <section
          aria-label={tCopilot('chatRegionAria')}
          className="@container flex-1 flex flex-col gap-4 min-w-0 min-h-0"
        >
          {/* Tool Activity Status Bar if executing */}
          {toolActivity && <ToolActivity activity={toolActivity} />}

          {/* Chat Stream Canvas */}
          <div
            ref={chatRef}
            onScroll={chatScroll.onScroll}
            role="log"
            aria-live="polite"
            className={cn(
              // Always a bounded scroller: unbounded, it grew with the chat and trapped the wheel.
              'flex-1 overflow-y-auto md:overscroll-contain space-y-5 pr-1.5 min-h-[300px] max-h-[65dvh]',
              isFull && 'xl:max-h-none'
            )}
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center max-w-lg mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-ai-violet/15 border border-ai-violet/40 flex items-center justify-center text-ai-violet mb-4 shadow-lg shadow-ai-violet/20">
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
                    onSelectPrompt={(p) => send(p)}
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
                  onMediaClick={(media) => setActiveLightboxMedia(media)}
                />
              ))
            )}

            {/* In-stream Pending Indicator if no text yet and tool completed */}
            {pending && !toolActivity && !answerStarted && (
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

          {/* Follow-up suggestions: one scrollable line, hidden while the copilot answers */}
          {messages.length > 0 && !pending && (
            <SuggestedPrompts
              variant="compact"
              onSelectPrompt={(p) => send(p)}
              result={result}
              activeStrategy={activeStrategy}
            />
          )}

          <ChatComposer
            composer={composer}
            voice={voice}
            pending={pending}
            onOpenSketch={() => setIsSketchOpen(true)}
          />
        </section>

        {/* Right / Context Column (Full view only) */}
        {isFull && <ContextPanel />}
      </div>

      {/* Media Lightbox Fullscreen Modal */}
      <MediaLightboxModal
        isOpen={Boolean(activeLightboxMedia)}
        media={activeLightboxMedia}
        onClose={() => setActiveLightboxMedia(null)}
      />

      {/* Interactive Canvas Sketch Dialog */}
      <CanvasSketchDialog
        isOpen={isSketchOpen}
        onClose={() => setIsSketchOpen(false)}
        onAttach={composer.addMedia}
      />
    </div>
  );
}
