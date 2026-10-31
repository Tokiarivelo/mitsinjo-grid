'use client';

import { useRef, useState } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Loader2,
  Paperclip,
  Edit3,
  X,
  Play,
  ChevronRight,
  ScanSearch,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChatComposerState } from '../hooks/use-chat-composer';
import type { useVoiceInput } from '../hooks/use-voice-input';
import { VisionDialog } from '@/features/vision-insert';
import { VoiceSpectrum } from './voice-spectrum';

export interface ChatComposerProps {
  composer: ChatComposerState;
  voice: ReturnType<typeof useVoiceInput>;
  pending: boolean;
  /** Shows the sketch button; the dialog lives with the parent (a glass panel would trap it). */
  onOpenSketch?: () => void;
  /** `card`: the copilot page input. `terminal`: one prompt line for the full-screen glass terminal. */
  variant?: 'card' | 'terminal';
  className?: string;
}

const ICON_BUTTON =
  'min-h-10 min-w-10 flex items-center justify-center rounded-lg border transition-colors cursor-pointer disabled:opacity-50';

/** Chat input: text, attachments, sketch, voice (with live spectrum) and send. */
export function ChatComposer({
  composer,
  voice,
  pending,
  onOpenSketch,
  variant = 'card',
  className,
}: ChatComposerProps) {
  const t = useTranslations('features.copilot');
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Attached image being searched for appliances (PV-T7); null = dialog closed. */
  const [visionImage, setVisionImage] = useState<string | null>(null);
  const terminal = variant === 'terminal';
  const isListening = voice.status === 'recording';
  const isTranscribing = voice.status === 'transcribing';
  const quietButton = terminal
    ? 'border-border/40 bg-surface/30 text-text-secondary hover:text-text-primary hover:bg-surface/60'
    : 'border-border bg-surface text-text-muted hover:text-text-primary hover:border-border/80';

  return (
    <div
      {...composer.dropZone}
      className={cn(
        'transition-colors',
        terminal
          ? 'p-2 rounded-2xl border bg-canvas-sunken/40'
          : 'p-3 rounded-xl bg-surface-elevated/60 border shadow-md',
        composer.isDraggingOver
          ? 'border-energy-cyan bg-energy-cyan/5 ring-2 ring-energy-cyan/30'
          : terminal
            ? 'border-border/40'
            : 'border-border',
        className
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            composer.addFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {composer.attachedMedia.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 p-2 rounded-lg bg-surface/70 border border-border/80">
          {composer.attachedMedia.map((med) => (
            <div
              key={med.id}
              className="relative group flex items-center gap-2 p-1 pr-2 rounded-lg bg-surface-elevated border border-border text-xs"
            >
              {med.type === 'video' ? (
                <div className="w-10 h-10 rounded bg-canvas-sunken flex items-center justify-center shrink-0">
                  <Play className="h-4 w-4 text-text-primary" aria-hidden="true" />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={med.url}
                  alt={med.name || t('mediaImage')}
                  className="w-10 h-10 rounded object-cover shrink-0 bg-surface"
                />
              )}
              <div className="min-w-0 max-w-[120px]">
                <span className="block truncate text-[11px] font-medium text-text-primary">
                  {med.name || (med.type === 'video' ? t('mediaVideo') : t('mediaImage'))}
                </span>
                <span className="block text-[9px] font-mono text-text-muted uppercase">
                  {med.type}
                </span>
              </div>
              {med.type === 'image' && (
                <button
                  type="button"
                  onClick={() => setVisionImage(med.url)}
                  aria-label={t('findAppliances')}
                  title={t('findAppliances')}
                  className="min-h-10 min-w-10 flex items-center justify-center rounded-lg text-energy-cyan hover:bg-energy-cyan/10 transition-colors cursor-pointer"
                >
                  <ScanSearch className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => composer.removeMedia(med.id)}
                aria-label={t('removeAttachment')}
                className="p-1 rounded-full text-text-muted hover:text-critical-red hover:bg-critical-red/10 transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {isListening && voice.analyser && (
        <VoiceSpectrum analyser={voice.analyser} className="mb-2" />
      )}

      {(voice.error || isTranscribing) && (
        <p
          role={voice.error ? 'alert' : 'status'}
          className={cn(
            'mb-2 flex items-start justify-between gap-2 px-2.5 py-1.5 rounded-md text-[11px] border',
            voice.error
              ? 'bg-warning-amber/10 border-warning-amber/40 text-text-primary'
              : 'bg-surface border-border text-text-secondary'
          )}
        >
          <span>{voice.error ? t(`voice.${voice.error}`) : t('voice.transcribing')}</span>
          {voice.error && (
            <button
              type="button"
              onClick={voice.clearError}
              aria-label={t('voice.dismiss')}
              className="shrink-0 text-text-muted hover:text-text-primary cursor-pointer"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </p>
      )}

      <div className={cn('relative flex gap-2', terminal ? 'items-end' : 'flex-col')}>
        {terminal && (
          <ChevronRight className="h-4 w-4 mb-3 shrink-0 text-battery-green" aria-hidden="true" />
        )}
        <textarea
          rows={terminal ? 1 : 2}
          value={composer.input}
          onChange={(e) => composer.setInput(e.target.value)}
          onKeyDown={composer.onKeyDown}
          onPaste={composer.onPaste}
          placeholder={
            composer.isDraggingOver
              ? t('dragDropHint')
              : terminal
                ? t('terminal.placeholder')
                : t('inputPlaceholder')
          }
          disabled={pending}
          aria-label={t('inputAria')}
          className={cn(
            'w-full resize-none text-text-primary placeholder:text-text-muted disabled:opacity-50 focus-visible:outline-none',
            terminal
              ? 'min-h-10 py-2.5 px-1 font-mono text-[13px] bg-transparent border-0 field-sizing-content max-h-32'
              : 'p-2.5 text-xs font-sans bg-surface border border-border rounded-control focus-visible:ring-2 focus-visible:ring-ai-violet focus-visible:ring-offset-1 focus-visible:ring-offset-canvas'
          )}
        />
        <div
          className={cn(
            'flex items-center gap-2 text-[11px] text-text-muted',
            terminal ? 'shrink-0' : 'justify-between'
          )}
        >
          {!terminal && <span className="hidden sm:inline">{t('shiftEnterHint')}</span>}
          <div className={cn('flex items-center gap-1.5 sm:gap-2', !terminal && 'ml-auto')}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={pending}
              aria-label={t('attachMedia')}
              title={t('attachMedia')}
              className={cn(ICON_BUTTON, quietButton)}
            >
              <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            {onOpenSketch && (
              <button
                type="button"
                onClick={onOpenSketch}
                disabled={pending}
                aria-label={t('sketchCanvas')}
                title={t('sketchCanvas')}
                className={cn(ICON_BUTTON, quietButton, 'hover:text-energy-cyan')}
              >
                <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              onClick={voice.toggle}
              disabled={pending || isTranscribing}
              aria-pressed={isListening}
              aria-label={
                isListening
                  ? t('voice.stop')
                  : isTranscribing
                    ? t('voice.transcribing')
                    : t('voiceInput')
              }
              title={isListening ? t('voice.stop') : t('voiceInput')}
              className={cn(
                ICON_BUTTON,
                'px-2 gap-1.5 text-xs',
                isListening
                  ? 'bg-critical-red/20 border-critical-red text-critical-red animate-pulse'
                  : quietButton
              )}
            >
              {isListening ? (
                <>
                  <MicOff className="h-3.5 w-3.5" aria-hidden="true" />
                  {!terminal && (
                    <span className="text-[10px] font-mono font-medium">{t('voiceListening')}</span>
                  )}
                </>
              ) : isTranscribing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>

            {terminal ? (
              <button
                type="button"
                onClick={composer.send}
                disabled={!composer.canSend}
                aria-label={t('sendButton')}
                title={t('sendButton')}
                className={cn(
                  ICON_BUTTON,
                  'border-ai-violet/60 bg-ai-violet/80 text-surface hover:bg-ai-violet'
                )}
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={composer.send}
                disabled={!composer.canSend}
                aria-label={t('sendButton')}
                icon={<Send className="h-3 w-3" aria-hidden="true" />}
                className="min-h-10 bg-ai-violet hover:bg-ai-violet/90 text-surface font-semibold"
              >
                {t('sendButton')}
              </Button>
            )}
          </div>
        </div>
      </div>
      <VisionDialog imageUrl={visionImage} onClose={() => setVisionImage(null)} />
    </div>
  );
}
