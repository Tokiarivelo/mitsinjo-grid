'use client';

import { useState } from 'react';
import { Sparkles, User, AlertCircle, AlertTriangle, Volume2, VolumeX, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';
import type { ChatMessageData, ProposalDecision, ProposalDiffItem } from '../types';
import { ConfirmProposalDialog } from './confirm-proposal-dialog';
import { ProposalDecisionMessage } from './proposal-decision-message';
import { MarkdownRenderer } from './markdown-renderer';
import { ChatChart } from './chat-chart';
import type { ActiveMedia } from './media-lightbox-modal';
import { formatTelemetryChannel } from '../utils/format-telemetry-channel';

export interface ChatMessageItemProps {
  message: ChatMessageData;
  onApproveProposal?: (message: ChatMessageData, items: ProposalDiffItem[]) => void;
  onRejectProposal?: (message: ChatMessageData, items: ProposalDiffItem[]) => void;
  /** Decision already taken on this message's proposal (locks the card). */
  proposalDecision?: ProposalDecision;
  onMediaClick?: (media: ActiveMedia) => void;
  className?: string;
}

export function ChatMessageItem({
  message,
  onApproveProposal,
  onRejectProposal,
  proposalDecision,
  onMediaClick,
  className,
}: ChatMessageItemProps) {
  const tCopilot = useTranslations('features.copilot');
  const tChannels = useTranslations('features.copilot.telemetryChannels');
  const tSectors = useTranslations('sectors');
  const tStrategies = useTranslations('strategies');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleToggleSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const textToRead = [
      message.sections?.whatHappened,
      message.sections?.whyItMatters,
      message.sections?.exploreNext,
    ]
      .filter(Boolean)
      .join('. ');

    if (!textToRead) return;

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  if (message.role === 'user') {
    return (
      <div className={cn('flex items-start gap-3.5 max-w-3xl self-end ml-auto', className)}>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-text-muted uppercase">
              {tCopilot('userRole')}
            </span>
            {message.timestamp && (
              <span className="text-[10px] font-mono text-text-muted/60">{message.timestamp}</span>
            )}
          </div>

          {/* User Attached Media Previews */}
          {message.media && message.media.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-end mb-2">
              {message.media.map((med) => (
                <button
                  key={med.id}
                  type="button"
                  onClick={() =>
                    onMediaClick?.({
                      url: med.url,
                      type: med.type,
                      title: med.name || (med.type === 'video' ? 'Video' : 'Image'),
                      caption: med.caption,
                    })
                  }
                  className="relative group rounded-xl overflow-hidden border border-border bg-surface-elevated hover:border-energy-cyan/80 transition-all cursor-pointer shadow-xs max-w-[200px]"
                >
                  {med.type === 'video' ? (
                    <div className="w-36 h-24 bg-black/80 flex flex-col items-center justify-center relative">
                      <Play className="h-6 w-6 text-white fill-white/80" />
                      <span className="absolute bottom-1 right-1 px-1 rounded text-[9px] font-mono bg-black/80 text-white">
                        VID
                      </span>
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={med.url}
                      alt={med.name || tCopilot('attachmentAlt')}
                      className="w-36 h-24 object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  )}
                  {med.name && (
                    <div className="p-1 px-2 text-[10px] text-text-muted truncate max-w-36 bg-surface/80">
                      {med.name}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {message.content && (
            <div className="bg-surface-elevated border border-border text-text-primary rounded-2xl rounded-tr-xs px-4 py-3 text-sm leading-relaxed shadow-xs">
              <MarkdownRenderer content={message.content} onMediaClick={onMediaClick} />
            </div>
          )}
        </div>
        <div className="hidden @md:flex w-8 h-8 rounded-full bg-surface-elevated border border-border items-center justify-center text-xs font-mono text-energy-cyan shrink-0 mt-3">
          <User className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (message.role === 'decision' && message.decision) {
    return (
      <ProposalDecisionMessage
        decision={message.decision}
        timestamp={message.timestamp}
        className={className}
      />
    );
  }

  if (message.role === 'error') {
    return (
      <div className={cn('flex items-start gap-3.5 max-w-3xl mr-auto', className)}>
        <div className="hidden @md:flex w-8 h-8 rounded-full bg-critical-red/15 border border-critical-red/40 items-center justify-center text-critical-red shrink-0 mt-1">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="flex-1 p-4 rounded-xl bg-critical-red/10 border border-critical-red/30 text-xs text-critical-red leading-relaxed">
          <div className="font-semibold mb-1 flex items-center gap-1.5">
            <span>{tCopilot('errorTitle')}</span>
          </div>
          <p>{message.errorKey ? tCopilot(message.errorKey) : message.content}</p>
          <span className="block mt-2 text-[11px] text-text-secondary">
            {tCopilot('errorFallbackNote')}
          </span>
        </div>
      </div>
    );
  }

  // Assistant Message
  const sections = message.sections;
  const evidenceList = (message.evidence ?? []).filter((e) => Object.keys(e.fields).length > 0);
  const proposal = message.proposal;

  return (
    <div className={cn('flex items-start gap-3.5 max-w-4xl mr-auto w-full', className)}>
      <div className="hidden @md:flex w-8 h-8 rounded-full bg-ai-violet/15 border border-ai-violet/50 items-center justify-center text-ai-violet shrink-0 mt-1 shadow-md shadow-ai-violet/30">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </div>

      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-ai-violet font-semibold tracking-wider">
              {tCopilot('aiCoreTitle')}
            </span>
            {message.detectedModel && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-ai-violet/10 border border-ai-violet/30 text-ai-violet font-medium">
                {message.detectedModel}
              </span>
            )}
            {message.timestamp && (
              <span className="text-[10px] font-mono text-text-muted/60">{message.timestamp}</span>
            )}
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-surface border border-border text-text-secondary">
              {tCopilot('simulatedProvenance')}
            </span>
          </div>

          {/* Voice readout button */}
          <button
            type="button"
            onClick={handleToggleSpeech}
            aria-label={isSpeaking ? tCopilot('stopAudio') : tCopilot('readAloud')}
            title={isSpeaking ? tCopilot('stopAudio') : tCopilot('readAloud')}
            className={cn(
              'p-1 rounded-md border text-[11px] transition-colors cursor-pointer',
              isSpeaking
                ? 'bg-solar-amber/20 border-solar-amber text-solar-amber animate-pulse'
                : 'bg-surface border-border/60 text-text-muted hover:text-text-primary hover:border-border'
            )}
          >
            {isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Offline answer: say why, quietly (computed numbers stay valid) */}
        {message.fallbackReason && (
          <div
            role="note"
            className="flex items-start gap-2 px-3 py-2 rounded-lg bg-warning-amber/10 border border-warning-amber/40 text-xs text-text-primary"
          >
            <AlertTriangle
              className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning-amber"
              aria-hidden="true"
            />
            <span>{tCopilot(`fallback.${message.fallbackReason}`)}</span>
          </div>
        )}

        {/* Structured diagnostic card */}
        <div className="bg-surface-elevated/70 border border-border/70 rounded-xl p-3 @md:p-5 flex flex-col gap-4 shadow-sm text-xs leading-relaxed">
          {/* Generated Image Card */}
          {message.imageUrl && (
            <div
              onClick={() =>
                onMediaClick?.({
                  url: message.imageUrl!,
                  type: 'image',
                  title: message.imageCaption || tCopilot('generatedImageAlt'),
                  caption: message.imageCaption,
                })
              }
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onMediaClick?.({
                    url: message.imageUrl!,
                    type: 'image',
                    title: message.imageCaption || tCopilot('generatedImageAlt'),
                    caption: message.imageCaption,
                  });
                }
              }}
              className="rounded-xl overflow-hidden border border-border/80 bg-surface shadow-sm cursor-pointer hover:border-energy-cyan/80 transition-all group"
            >
              <div className="relative aspect-video w-full bg-surface-elevated/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={message.imageUrl}
                  alt={message.imageCaption || tCopilot('generatedImageAlt')}
                  className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-200"
                  loading="lazy"
                />
                <div className="absolute top-2 right-2 flex gap-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface/90 text-text-primary backdrop-blur-sm border border-border/60 shadow-xs">
                    {message.detectedModel || 'muse-image-1.0'}
                  </span>
                </div>
              </div>
              {message.imageCaption && (
                <p className="p-3 text-xs text-text-secondary border-t border-border/60 font-sans">
                  {message.imageCaption}
                </p>
              )}
            </div>
          )}

          {/* Generated Video Card */}
          {message.videoUrl && (
            <div
              onClick={() =>
                onMediaClick?.({
                  url: message.videoUrl!,
                  type: 'video',
                  title: message.videoCaption || tCopilot('generatedVideoTitle'),
                  caption: message.videoCaption,
                })
              }
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onMediaClick?.({
                    url: message.videoUrl!,
                    type: 'video',
                    title: message.videoCaption || tCopilot('generatedVideoTitle'),
                    caption: message.videoCaption,
                  });
                }
              }}
              className="rounded-xl overflow-hidden border border-border/80 bg-surface shadow-sm cursor-pointer hover:border-energy-cyan/80 transition-all group"
            >
              <div className="relative aspect-video w-full bg-black flex items-center justify-center">
                <video
                  src={message.videoUrl}
                  className="w-full h-full object-contain pointer-events-none"
                  preload="metadata"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-energy-cyan/90 text-surface flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="h-6 w-6 ml-0.5 fill-current" />
                  </div>
                </div>
              </div>
              {message.videoCaption && (
                <p className="p-3 text-xs text-text-secondary border-t border-border/60 font-sans">
                  {message.videoCaption}
                </p>
              )}
            </div>
          )}

          {/* Assistant Media List */}
          {message.media && message.media.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {message.media.map((med) => (
                <button
                  key={med.id}
                  type="button"
                  onClick={() =>
                    onMediaClick?.({
                      url: med.url,
                      type: med.type,
                      title: med.name || (med.type === 'video' ? 'Video' : 'Image'),
                      caption: med.caption,
                    })
                  }
                  className="relative group rounded-xl overflow-hidden border border-border bg-surface hover:border-energy-cyan/80 transition-all cursor-pointer shadow-xs max-w-[220px]"
                >
                  {med.type === 'video' ? (
                    <div className="w-40 h-28 bg-black/80 flex items-center justify-center relative">
                      <Play className="h-6 w-6 text-white fill-white/80" />
                      <span className="absolute bottom-1 right-1 px-1 rounded text-[9px] font-mono bg-black/80 text-white">
                        VID
                      </span>
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={med.url}
                      alt={med.name || tCopilot('attachmentAlt')}
                      className="w-40 h-28 object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  )}
                  {med.name && (
                    <div className="p-1 px-2 text-[10px] text-text-muted truncate max-w-40 bg-surface/80">
                      {med.name}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Assistant Interactive Chart */}
          {message.chart && <ChatChart data={message.chart} />}

          {sections?.whatHappened && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-mono text-solar-amber uppercase font-semibold tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-solar-amber" />
                <span>{tCopilot('sectionWhatHappened')}</span>
              </div>
              <div className="text-text-primary text-sm leading-relaxed pl-3 border-l-2 border-solar-amber/40">
                <MarkdownRenderer content={sections.whatHappened} onMediaClick={onMediaClick} />
              </div>
            </div>
          )}

          {/* Computed Evidence Section */}
          {(sections?.computedEvidence || evidenceList.length > 0) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-mono text-energy-cyan uppercase font-semibold tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-energy-cyan" />
                  <span>{tCopilot('sectionEvidence')}</span>
                </div>
              </div>

              {sections?.computedEvidence && (
                <div className="text-text-secondary font-mono text-xs pl-3 border-l-2 border-energy-cyan/40 whitespace-pre-wrap">
                  {sections.computedEvidence}
                </div>
              )}

              {evidenceList.map((evidence, idx) => (
                <div
                  key={`${evidence.resultId}-${idx}`}
                  className="overflow-x-auto rounded-lg border border-border/60 bg-surface"
                >
                  <div className="px-3 pt-2 text-[10px] font-mono text-energy-cyan">
                    {evidence.resultId}
                  </div>
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead>
                      <tr className="border-b border-border/40 bg-surface-elevated text-text-muted text-[10px]">
                        <th className="py-2 px-3 font-semibold">{tCopilot('tableChannel')}</th>
                        <th className="py-2 px-3 font-semibold">{tCopilot('tableValue')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30 text-text-primary">
                      {Object.entries(evidence.fields).map(([k, v]) => (
                        <tr key={k} className="hover:bg-surface-elevated/40 transition-colors">
                          <td className="py-2.5 px-3 text-text-secondary" title={k}>
                            <span className="font-sans font-medium text-text-primary text-xs">
                              {formatTelemetryChannel(k, {
                                tChannels,
                                tSectors,
                                tStrategies,
                              })}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-energy-cyan whitespace-nowrap">
                            {String(v)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* Section 3: Why it matters */}
          {sections?.whyItMatters && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-mono text-critical-red uppercase font-semibold tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-critical-red" />
                <span>{tCopilot('sectionWhyItMatters')}</span>
              </div>
              <div className="text-text-primary text-sm leading-relaxed pl-3 border-l-2 border-critical-red/40">
                <MarkdownRenderer content={sections.whyItMatters} onMediaClick={onMediaClick} />
              </div>
            </div>
          )}

          {/* Section 4: Explore next */}
          {sections?.exploreNext && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-mono text-ai-violet uppercase font-semibold tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-ai-violet" />
                <span>{tCopilot('sectionExploreNext')}</span>
              </div>
              <div className="text-text-primary text-sm leading-relaxed pl-3 border-l-2 border-ai-violet/40">
                <MarkdownRenderer content={sections.exploreNext} onMediaClick={onMediaClick} />
              </div>
            </div>
          )}

          {/* Fallback for raw text before streaming finishes */}
          {!sections && message.content && (
            <div className="text-text-primary">
              <MarkdownRenderer content={message.content} onMediaClick={onMediaClick} />
            </div>
          )}
        </div>

        {/* Embedded Scenario Proposal Card */}
        {proposal && onApproveProposal && onRejectProposal && (
          <ConfirmProposalDialog
            proposal={proposal}
            decision={proposalDecision}
            onApprove={(items) => onApproveProposal(message, items)}
            onReject={(items) => onRejectProposal(message, items)}
          />
        )}
      </div>
    </div>
  );
}
