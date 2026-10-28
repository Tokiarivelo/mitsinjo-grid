'use client';

import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent,
  type ClipboardEvent,
  type DragEvent,
} from 'react';
import {
  Send,
  Sparkles,
  Bot,
  AlertTriangle,
  Mic,
  MicOff,
  Paperclip,
  Edit3,
  X,
  Play,
  History,
  Plus,
  Trash2,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCopilot } from '../hooks/use-copilot';
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

export function CopilotWorkspace({ mode = 'full', className }: CopilotWorkspaceProps) {
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
    availableModels,
    selectedModel,
    setSelectedModel,
    sendMessage,
    approveProposal,
    rejectProposal,
  } = useCopilot();

  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [attachedMedia, setAttachedMedia] = useState<ChatMediaItem[]>([]);
  const [activeLightboxMedia, setActiveLightboxMedia] = useState<ActiveMedia | null>(null);
  const [isSketchOpen, setIsSketchOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showSessionsDrawer, setShowSessionsDrawer] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, toolActivity, pending]);

  const handleAddFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) return;

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAttachedMedia((prev) => [
            ...prev,
            {
              id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              url: reader.result as string,
              type: isVideo ? 'video' : 'image',
              name: file.name,
              size: file.size,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      handleAddFiles(e.clipboardData.files);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleRemoveMedia = (id: string) => {
    setAttachedMedia((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSend = () => {
    if ((!input.trim() && attachedMedia.length === 0) || pending) return;
    sendMessage(input, attachedMedia);
    setInput('');
    setAttachedMedia([]);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleToggleVoice = () => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert(tCopilot('voiceNotSupported'));
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = document.documentElement.lang || 'fr-FR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const isFull = mode === 'full';

  const formatModelLabel = (m: string) => {
    if (m === 'auto') return tCopilot('modelAuto');
    if (m === 'muse-spark-1.3') return 'muse-spark-1.3 (Copilot + Outils)';
    if (m === 'muse-wonder-1.0') return 'muse-wonder-1.0 (Raisonnement)';
    if (m === 'muse-image-1.0') return 'muse-image-1.0 (Image)';
    return m;
  };

  return (
    <div className={cn('flex-1 flex flex-col min-h-0', className)}>
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

            {/* Meta Model & Mode Selector */}
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
                      {formatModelLabel(m)}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-energy-cyan font-medium text-xs">
                  {formatModelLabel(selectedModel || 'auto')}
                </span>
              )}
            </div>

            <StatusBadge variant="simulated" label={tCommon('simulatedData')} size="sm" />
          </div>
        </div>
      ) : (
        /* Header Area (Panel Mode on Simulation Page) */
        <div className="px-3 py-2.5 border-b border-border/60 bg-surface/70 rounded-t-lg flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 rounded bg-ai-violet/10 text-ai-violet shrink-0">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <span className="text-xs font-semibold text-text-primary truncate">
              {tCopilot('title')}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Panel Mode Selector */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-elevated border border-border text-[11px] font-mono">
              <span className="text-[9px] text-text-muted uppercase font-semibold">
                {tCopilot('modelSelectorLabel')}
              </span>
              {availableModels.length > 1 ? (
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  aria-label={tCopilot('modelSelectorLabel')}
                  className="bg-transparent text-energy-cyan font-medium border-none focus:outline-none cursor-pointer text-[11px]"
                >
                  {availableModels.map((m) => (
                    <option key={m} value={m} className="bg-surface text-text-primary">
                      {m === 'auto' ? tCopilot('modelAuto') : m}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-energy-cyan font-medium text-[11px]">
                  {selectedModel || 'auto'}
                </span>
              )}
            </div>

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
                className="p-1 rounded text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
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
                      className="p-1 rounded opacity-0 group-hover:opacity-100 text-text-muted hover:text-critical-red transition-opacity cursor-pointer shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
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
                  onMediaClick={(media) => setActiveLightboxMedia(media)}
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

          {/* Query Input Dock with Drag & Drop */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'p-3 rounded-xl bg-surface-elevated/60 border shadow-md transition-colors',
              isDraggingOver
                ? 'border-energy-cyan bg-energy-cyan/5 ring-2 ring-energy-cyan/30'
                : 'border-border'
            )}
          >
            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  handleAddFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />

            {/* Attached Media Tray */}
            {attachedMedia.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 p-2 rounded-lg bg-surface border border-border/80">
                {attachedMedia.map((med) => (
                  <div
                    key={med.id}
                    className="relative group flex items-center gap-2 p-1 pr-2 rounded-lg bg-surface-elevated border border-border text-xs"
                  >
                    {med.type === 'video' ? (
                      <div className="w-10 h-10 rounded bg-black flex items-center justify-center shrink-0">
                        <Play className="h-4 w-4 text-white" />
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={med.url}
                        alt={med.name || 'attachment'}
                        className="w-10 h-10 rounded object-cover shrink-0 bg-surface"
                      />
                    )}
                    <div className="min-w-0 max-w-[120px]">
                      <span className="block truncate text-[11px] font-medium text-text-primary">
                        {med.name || (med.type === 'video' ? 'Video' : 'Image')}
                      </span>
                      <span className="block text-[9px] font-mono text-text-muted uppercase">
                        {med.type}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(med.id)}
                      aria-label={tCopilot('removeAttachment')}
                      className="p-1 rounded-full text-text-muted hover:text-critical-red hover:bg-critical-red/10 transition-colors cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative flex flex-col gap-2">
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={
                  isDraggingOver ? tCopilot('dragDropHint') : tCopilot('inputPlaceholder')
                }
                disabled={pending}
                aria-label={tCopilot('inputAria')}
                className="w-full resize-none p-2.5 text-xs font-sans text-text-primary bg-surface border border-border rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-violet focus-visible:ring-offset-1 focus-visible:ring-offset-canvas placeholder:text-text-muted disabled:opacity-50"
              />
              <div className="flex items-center justify-between text-[11px] text-text-muted">
                <span>{tCopilot('shiftEnterHint')}</span>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* File upload button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={pending}
                    aria-label={tCopilot('attachMedia')}
                    title={tCopilot('attachMedia')}
                    className="p-2 rounded-lg border border-border bg-surface text-text-muted hover:text-text-primary hover:border-border/80 transition-colors cursor-pointer"
                  >
                    <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>

                  {/* Canvas sketch button */}
                  <button
                    type="button"
                    onClick={() => setIsSketchOpen(true)}
                    disabled={pending}
                    aria-label={tCopilot('sketchCanvas')}
                    title={tCopilot('sketchCanvas')}
                    className="p-2 rounded-lg border border-border bg-surface text-text-muted hover:text-energy-cyan hover:border-energy-cyan/60 transition-colors cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>

                  {/* Voice input button */}
                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    disabled={pending}
                    aria-label={isListening ? tCopilot('voiceListening') : tCopilot('voiceInput')}
                    title={isListening ? tCopilot('voiceListening') : tCopilot('voiceInput')}
                    className={cn(
                      'p-2 rounded-lg border text-xs transition-all cursor-pointer flex items-center gap-1.5',
                      isListening
                        ? 'bg-critical-red/20 border-critical-red text-critical-red animate-pulse'
                        : 'bg-surface border-border text-text-muted hover:text-text-primary hover:border-border/80'
                    )}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="text-[10px] font-mono font-medium">
                          {tCopilot('voiceListening')}
                        </span>
                      </>
                    ) : (
                      <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>

                  {/* Send Button */}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSend}
                    disabled={(!input.trim() && attachedMedia.length === 0) || pending}
                    aria-label={tCopilot('sendButton')}
                    icon={<Send className="h-3 w-3" aria-hidden="true" />}
                    className="bg-ai-violet hover:bg-ai-violet/90 text-surface font-semibold"
                  >
                    {tCopilot('sendButton')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
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
        onAttach={(media) => setAttachedMedia((prev) => [...prev, media])}
      />
    </div>
  );
}
