'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { COPILOT_FILL_EVENT, type CopilotFillDetail } from '@/lib/copilot-fill';
import {
  Sparkles,
  AlertTriangle,
  X,
  History,
  Plus,
  Trash2,
  Zap,
  ShieldAlert,
  Users,
  Camera,
  MessageSquare,
  Cpu,
} from 'lucide-react';
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
import { ReportFireControl, detectVoiceFireOrder, useActiveFires } from '@/features/fire-alert';
import type { SectorId } from '@mitsinjo/engine';
import { STRATEGIES, scenarios } from '@mitsinjo/engine';
import { fmtKw, fmtKwh } from '@/lib/format';
import type { ChatMediaItem } from '../types';
import { ChatMessageItem } from './chat-message-item';
import { ToolActivity } from './tool-activity';
import { SuggestedPrompts } from './suggested-prompts';
import { ContextPanel } from './context-panel';
import { MeetingPanel } from './meeting-panel';
import { DispatchLogPanel } from '@/features/autopilot';
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

  const scenarioId = useSimulationStore((s) => s.scenarioId);
  const activeStrategy = useSimulationStore((s) => s.activeStrategy);
  const result = useSimulationStore((s) => s.results[s.activeStrategy]);
  const input = useSimulationStore((s) => s.input);
  // Fires burning now steer the suggested questions (« Ask the copilot » on the fire banner lands here).
  const fires = useActiveFires();
  const fireSectors = useMemo(() => fires.map((f) => f.sector), [fires]);
  const scenarioTitle = scenarios[scenarioId]?.title || scenarioId;
  const strategyInfo = STRATEGIES[activeStrategy];

  const [mobileTab, setMobileTab] = useState<'chat' | 'telemetry' | 'meeting'>('chat');

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
    proposeFromPerception,
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
  const latestScenarioDraft = useMemo(
    () => [...messages].reverse().find((m) => m.scenarioDraft)?.scenarioDraft,
    [messages]
  );
  const answerStarted = lastMessage?.role === 'assistant' && lastMessage.content.length > 0;
  const chatRef = useRef<HTMLDivElement>(null);
  const chatScroll = useStickToBottom(chatRef, [messages, toolActivity, pending]);

  const send = useCallback(
    (prompt: string, media?: ChatMediaItem[]) => {
      chatScroll.stick();
      sendMessage(prompt, media);
    },
    [chatScroll, sendMessage]
  );
  const composer = useChatComposer({ onSend: send, pending });
  // Voice urgency order (M3-T3): the text goes to the field and the fire dialog opens pre-filled.
  const [firePreset, setFirePreset] = useState<{ sector: SectorId; nonce: number } | null>(null);
  // Smoke on a photo (M8-T3): the dialog opens, the operator picks the sector — never automatic.
  const [fireVision, setFireVision] = useState<number | null>(null);
  const reportKey = `${firePreset ? `preset-${firePreset.nonce}` : 'idle'}-v${fireVision ?? 0}`;
  const handleVoiceText = (text: string) => {
    composer.appendText(text);
    const sector = detectVoiceFireOrder(text);
    if (sector) setFirePreset((prev) => ({ sector, nonce: (prev?.nonce ?? 0) + 1 }));
  };
  const voice = useVoiceInput({
    locale,
    sessionId,
    onText: handleVoiceText,
    onAutoSend: (text) => send(text),
  });

  useEffect(() => {
    const handleFill = (e: Event) => {
      const detail = (e as CustomEvent<CopilotFillDetail>).detail;
      if (detail?.prompt) {
        if (detail.autoSend) {
          send(detail.prompt);
        } else {
          composer.setInput(detail.prompt);
        }
      }
    };
    window.addEventListener(COPILOT_FILL_EVENT, handleFill);
    return () => window.removeEventListener(COPILOT_FILL_EVENT, handleFill);
  }, [composer, send]);

  const isFull = mode === 'full';

  return (
    // Wide /copilot: the workspace fills the main area so the chat scrolls inside it.
    <div className={cn('flex-1 flex flex-col min-h-0', isFull && 'xl:h-full', className)}>
      {/* Header Area (Full Mode) */}
      {isFull ? (
        <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 border-b border-border/70 bg-surface/85 backdrop-blur-md sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative p-2.5 rounded-xl bg-ai-violet/10 border border-ai-violet/30 text-ai-violet shadow-xs">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ai-violet opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-ai-violet" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base sm:text-lg font-display font-bold text-text-primary tracking-tight">
                  {tCopilot('title')}
                </h1>
                <StatusBadge variant="ai" label={tCopilot('badge')} size="sm" />
              </div>
              <p className="text-xs text-text-secondary mt-0.5 hidden sm:block">
                {tCopilot('subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Session Management Buttons */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={newSession}
                icon={<Plus className="h-3 w-3" />}
                className="h-8 text-xs px-2.5 font-medium cursor-pointer"
                title={tCopilot('newSession')}
              >
                <span className="hidden sm:inline">{tCopilot('newSession')}</span>
                <span className="sm:hidden">New</span>
              </Button>
              <button
                type="button"
                onClick={() => setShowSessionsDrawer((v) => !v)}
                aria-label={tCopilot('chatSessions')}
                title={tCopilot('chatSessions')}
                className={cn(
                  'h-8 px-2.5 rounded-lg border text-xs transition-colors cursor-pointer flex items-center gap-1.5 font-mono text-[11px]',
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

            {/* Report a fire from the chat too (M2-T2 reste, M2-T4). */}
            <ReportFireControl
              variant="hud"
              align="right"
              key={reportKey}
              defaultOpenSector={firePreset?.sector}
              defaultOpen={fireVision !== null}
            />

            <StatusBadge variant="simulated" label={tCommon('simulatedData')} size="sm" />
          </div>
        </div>
      ) : (
        /* Header Area (Panel Mode on Simulation Page) */
        <div className="px-3 py-2 border-b border-border/60 bg-surface/70 shrink-0 flex flex-wrap items-center justify-between gap-2">
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

            {/* Report a fire from the chat too (M2-T2 reste, M2-T4). */}
            <ReportFireControl
              variant="hud"
              align="right"
              key={reportKey}
              defaultOpenSector={firePreset?.sector}
              defaultOpen={fireVision !== null}
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

      {/* Mobile / Tablet Segmented Tab Bar (< xl) */}
      {isFull && (
        <div className="xl:hidden px-3 pt-3 max-w-[1720px] w-full mx-auto">
          <div className="flex gap-1 p-1 bg-surface-elevated/80 border border-border/80 rounded-xl">
            <button
              type="button"
              onClick={() => setMobileTab('chat')}
              className={cn(
                'flex-1 min-h-11 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer',
                mobileTab === 'chat'
                  ? 'bg-surface text-text-primary shadow-xs font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <MessageSquare className="h-4 w-4 text-ai-violet" aria-hidden="true" />
              <span>{tCopilot('tabChat')}</span>
              {messages.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-ai-violet/15 text-ai-violet">
                  {messages.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('telemetry')}
              className={cn(
                'flex-1 min-h-11 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer',
                mobileTab === 'telemetry'
                  ? 'bg-surface text-text-primary shadow-xs font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <Cpu className="h-4 w-4 text-energy-cyan" aria-hidden="true" />
              <span>{tCopilot('tabTelemetry')}</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('meeting')}
              className={cn(
                'flex-1 min-h-11 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer',
                mobileTab === 'meeting'
                  ? 'bg-surface text-text-primary shadow-xs font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <Users className="h-4 w-4 text-ai-violet" aria-hidden="true" />
              <span>{tCopilot('tabMeeting')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Two-Column Operational Deck */}
      <div
        className={cn(
          'flex-1 flex min-h-0',
          isFull
            ? 'flex-col xl:flex-row max-w-[1720px] w-full mx-auto p-3 sm:p-4 lg:p-6 gap-4 lg:gap-6'
            : 'flex-col p-2.5 gap-2'
        )}
      >
        {/* Left / Conversation Canvas */}
        <section
          aria-label={tCopilot('chatRegionAria')}
          className={cn(
            '@container flex-1 flex flex-col gap-2 min-w-0 min-h-0',
            mobileTab !== 'chat' && 'hidden xl:flex'
          )}
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
              'flex-1 overflow-y-auto md:overscroll-contain pr-1.5 min-h-0 max-h-[65dvh]',
              isFull ? 'space-y-5 min-h-[300px] xl:max-h-none' : 'space-y-3'
            )}
          >
            {messages.length === 0 ? (
              isFull ? (
                <div className="flex flex-col items-center justify-center h-full py-8 sm:py-12 text-center max-w-2xl mx-auto px-2">
                  {/* Hero Glow Icon */}
                  <div className="relative mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-ai-violet/10 border border-ai-violet/30 flex items-center justify-center text-ai-violet shadow-lg shadow-ai-violet/15">
                      <Sparkles className="h-7 w-7" aria-hidden="true" />
                    </div>
                    <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ai-violet opacity-75" />
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-ai-violet" />
                    </span>
                  </div>

                  <h2 className="font-display text-lg sm:text-2xl font-bold text-text-primary tracking-tight">
                    {tCopilot('emptyGreeting')}
                  </h2>
                  <p className="text-xs sm:text-sm text-text-secondary mt-2 leading-relaxed max-w-lg">
                    {tCopilot('emptyDescription')}
                  </p>

                  {/* Live Microgrid State Pill */}
                  <div className="w-full max-w-lg mt-5 p-3 rounded-xl border border-border/70 bg-surface/70 backdrop-blur-xs flex flex-wrap items-center justify-around gap-2 text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-text-secondary">
                      <span className="w-2 h-2 rounded-full bg-energy-cyan animate-pulse" />
                      <span className="text-[10px] text-text-muted uppercase">
                        {tCopilot('starterScenarioLabel')}
                      </span>
                      <span className="font-semibold text-text-primary">{scenarioTitle}</span>
                    </div>
                    <div className="h-3 w-px bg-border/80 hidden sm:block" />
                    <div className="flex items-center gap-1.5 text-text-secondary">
                      <span className="text-[10px] text-text-muted uppercase">
                        {tCopilot('starterStrategyLabel')}
                      </span>
                      <span className="font-semibold text-energy-cyan">
                        {strategyInfo?.label || activeStrategy}
                      </span>
                    </div>
                    <div className="h-3 w-px bg-border/80 hidden sm:block" />
                    <div className="flex items-center gap-2 text-text-muted text-[11px]">
                      <span>{tCopilot('starterPv', { value: fmtKw(input.solar.peakKw) })}</span>
                      <span>•</span>
                      <span>
                        {tCopilot('starterBess', { value: fmtKwh(input.battery.capacityKwh) })}
                      </span>
                    </div>
                  </div>

                  {/* 4 Autonomous Capabilities Cards */}
                  <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-6 text-left">
                    <button
                      type="button"
                      onClick={() => send(tCopilot('promptCompareStrategies'))}
                      className="p-3.5 rounded-xl border border-border/70 bg-surface hover:border-ai-violet/50 hover:bg-surface-elevated transition-all cursor-pointer group shadow-xs text-left"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="p-1 rounded-md bg-solar-amber/10 text-solar-amber">
                          <Zap className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <span className="text-xs font-semibold text-text-primary group-hover:text-ai-violet transition-colors">
                          {tCopilot('capStrategyTitle')}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-secondary leading-relaxed">
                        {tCopilot('capStrategyDesc')}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => send(tCopilot('promptProtectEssential'))}
                      className="p-3.5 rounded-xl border border-border/70 bg-surface hover:border-ai-violet/50 hover:bg-surface-elevated transition-all cursor-pointer group shadow-xs text-left"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="p-1 rounded-md bg-secondary/10 text-secondary">
                          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <span className="text-xs font-semibold text-text-primary group-hover:text-ai-violet transition-colors">
                          {tCopilot('capLifelineTitle')}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-secondary leading-relaxed">
                        {tCopilot('capLifelineDesc')}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined' && window.innerWidth < 1280) {
                          setMobileTab('meeting');
                        }
                      }}
                      className="p-3.5 rounded-xl border border-border/70 bg-surface hover:border-ai-violet/50 hover:bg-surface-elevated transition-all cursor-pointer group shadow-xs text-left"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="p-1 rounded-md bg-ai-violet/10 text-ai-violet">
                          <Users className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <span className="text-xs font-semibold text-text-primary group-hover:text-ai-violet transition-colors">
                          {tCopilot('capMeetingTitle')}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-secondary leading-relaxed">
                        {tCopilot('capMeetingDesc')}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsSketchOpen(true)}
                      className="p-3.5 rounded-xl border border-border/70 bg-surface hover:border-ai-violet/50 hover:bg-surface-elevated transition-all cursor-pointer group shadow-xs text-left"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="p-1 rounded-md bg-energy-cyan/10 text-energy-cyan">
                          <Camera className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <span className="text-xs font-semibold text-text-primary group-hover:text-ai-violet transition-colors">
                          {tCopilot('capPerceptionTitle')}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-secondary leading-relaxed">
                        {tCopilot('capPerceptionDesc')}
                      </p>
                    </button>
                  </div>

                  <div className="w-full mt-6">
                    <SuggestedPrompts
                      onSelectPrompt={(p) => send(p)}
                      disabled={pending}
                      result={result}
                      input={input}
                      activeStrategy={activeStrategy}
                      fires={fireSectors}
                      scenarioDraft={latestScenarioDraft}
                    />
                  </div>
                </div>
              ) : (
                /* Compact Starter in Panel Mode: contextual prompts without giant cards */
                <div className="flex flex-col gap-2 py-1 px-0.5">
                  <div className="p-2.5 rounded-xl border border-border/60 bg-surface/70 flex items-start gap-2.5">
                    <div className="p-1.5 rounded-lg bg-ai-violet/10 text-ai-violet shrink-0 mt-0.5">
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <p className="text-xs font-semibold text-text-primary">
                        {tCopilot('emptyGreeting')}
                      </p>
                      <p className="text-[11px] text-text-secondary leading-relaxed">
                        {tCopilot('emptyDescription')}
                      </p>
                    </div>
                  </div>

                  <SuggestedPrompts
                    onSelectPrompt={(p) => send(p)}
                    disabled={pending}
                    result={result}
                    input={input}
                    activeStrategy={activeStrategy}
                    fires={fireSectors}
                    scenarioDraft={latestScenarioDraft}
                  />
                </div>
              )
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
                  locale={locale}
                  onProposePerception={proposeFromPerception}
                  onReportFire={() => setFireVision((n) => (n ?? 0) + 1)}
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
            <div className="shrink-0">
              <SuggestedPrompts
                variant="compact"
                onSelectPrompt={(p) => send(p)}
                result={result}
                input={input}
                activeStrategy={activeStrategy}
                fires={fireSectors}
                scenarioDraft={latestScenarioDraft}
              />
            </div>
          )}

          <ChatComposer
            composer={composer}
            voice={voice}
            pending={pending}
            onOpenSketch={() => setIsSketchOpen(true)}
          />
        </section>

        {/* Right / Context Column (Full view only) */}
        {isFull && (
          <div
            className={cn(
              'w-full xl:w-[380px] flex flex-col gap-4 shrink-0 xl:overflow-y-auto xl:min-h-0',
              mobileTab === 'chat' && 'hidden xl:flex'
            )}
          >
            {/* Village meeting: record → diarize → priorities → proposed patch (M10-T4) */}
            <div className={cn(mobileTab === 'telemetry' && 'hidden xl:block')}>
              <MeetingPanel />
            </div>
            <div className={cn(mobileTab === 'meeting' && 'hidden xl:block')}>
              <ContextPanel className="w-full" />
            </div>
            <div className={cn(mobileTab === 'meeting' && 'hidden xl:block')}>
              <DispatchLogPanel compact className="w-full" />
            </div>
          </div>
        )}
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
