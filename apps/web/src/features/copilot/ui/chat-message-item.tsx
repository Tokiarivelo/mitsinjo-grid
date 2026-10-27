'use client';

import { Sparkles, User, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';
import type { ChatMessageData } from '../types';
import { ConfirmProposalDialog } from './confirm-proposal-dialog';

export interface ChatMessageItemProps {
  message: ChatMessageData;
  onApproveProposal?: () => void;
  onRejectProposal?: () => void;
  className?: string;
}

export function ChatMessageItem({
  message,
  onApproveProposal,
  onRejectProposal,
  className,
}: ChatMessageItemProps) {
  const tCopilot = useTranslations('features.copilot');

  if (message.role === 'user') {
    return (
      <div className={cn('flex items-start gap-3.5 max-w-3xl self-end ml-auto', className)}>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-text-muted uppercase">
              {tCopilot('userRole')}
            </span>
            {message.timestamp && (
              <span className="text-[10px] font-mono text-text-muted/60">
                {message.timestamp}
              </span>
            )}
          </div>
          <div className="bg-surface-elevated border border-border text-text-primary rounded-2xl rounded-tr-xs px-4 py-3 text-sm leading-relaxed shadow-xs">
            {message.content}
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-surface-elevated border border-border flex items-center justify-center text-xs font-mono text-energy-cyan shrink-0 mt-3">
          <User className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (message.role === 'error') {
    return (
      <div className={cn('flex items-start gap-3.5 max-w-3xl mr-auto', className)}>
        <div className="w-8 h-8 rounded-full bg-critical-red/15 border border-critical-red/40 flex items-center justify-center text-critical-red shrink-0 mt-1">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="flex-1 p-4 rounded-xl bg-critical-red/10 border border-critical-red/30 text-xs text-critical-red leading-relaxed">
          <div className="font-semibold mb-1 flex items-center gap-1.5">
            <span>{tCopilot('errorTitle')}</span>
          </div>
          <p>{message.content}</p>
          <span className="block mt-2 text-[11px] text-text-secondary">
            {tCopilot('errorFallbackNote')}
          </span>
        </div>
      </div>
    );
  }

  // Assistant Message
  const sections = message.sections;
  const evidence = message.evidence;
  const proposal = message.proposal;

  return (
    <div className={cn('flex items-start gap-3.5 max-w-4xl mr-auto w-full', className)}>
      <div className="w-8 h-8 rounded-full bg-ai-violet/15 border border-ai-violet/50 flex items-center justify-center text-ai-violet shrink-0 mt-1 shadow-[0_0_12px_rgba(182,160,255,0.3)]">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </div>

      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono text-ai-violet font-semibold tracking-wider">
            {tCopilot('aiCoreTitle')}
          </span>
          {message.timestamp && (
            <span className="text-[10px] font-mono text-text-muted/60">
              {message.timestamp}
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-surface border border-border text-text-secondary">
            {tCopilot('simulatedProvenance')}
          </span>
        </div>

        {/* Structured diagnostic card */}
        <div className="bg-surface-elevated/70 border border-border/70 rounded-xl p-5 flex flex-col gap-4 shadow-sm text-xs leading-relaxed">
          {sections?.whatHappened && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-mono text-energy-amber uppercase font-semibold tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-energy-amber" />
                <span>{tCopilot('sectionWhatHappened')}</span>
              </div>
              <p className="text-text-primary text-sm leading-relaxed pl-3 border-l-2 border-energy-amber/40">
                {sections.whatHappened}
              </p>
            </div>
          )}

          {/* Computed Evidence Section */}
          {(sections?.computedEvidence || (evidence && Object.keys(evidence.fields).length > 0)) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-mono text-energy-cyan uppercase font-semibold tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-energy-cyan" />
                  <span>{tCopilot('sectionEvidence')}</span>
                </div>
                {evidence?.resultId && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-energy-cyan">
                    {evidence.resultId}
                  </span>
                )}
              </div>

              {sections?.computedEvidence && (
                <div className="text-text-secondary font-mono text-xs pl-3 border-l-2 border-energy-cyan/40 whitespace-pre-wrap">
                  {sections.computedEvidence}
                </div>
              )}

              {evidence && Object.keys(evidence.fields).length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-border/60 bg-surface">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead>
                      <tr className="border-b border-border/40 bg-surface-elevated text-text-muted text-[10px]">
                        <th className="py-2 px-3 font-semibold">{tCopilot('tableChannel')}</th>
                        <th className="py-2 px-3 font-semibold">{tCopilot('tableValue')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30 text-text-primary">
                      {Object.entries(evidence.fields).map(([k, v]) => (
                        <tr key={k} className="hover:bg-surface-elevated/40">
                          <td className="py-2 px-3 text-text-secondary">{k}</td>
                          <td className="py-2 px-3 font-semibold text-energy-cyan">
                            {String(v)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Why it matters */}
          {sections?.whyItMatters && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-mono text-critical-red uppercase font-semibold tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-critical-red" />
                <span>{tCopilot('sectionWhyItMatters')}</span>
              </div>
              <p className="text-text-primary text-sm leading-relaxed pl-3 border-l-2 border-critical-red/40">
                {sections.whyItMatters}
              </p>
            </div>
          )}

          {/* Section 4: Explore next */}
          {sections?.exploreNext && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-mono text-ai-violet uppercase font-semibold tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-ai-violet" />
                <span>{tCopilot('sectionExploreNext')}</span>
              </div>
              <p className="text-text-primary text-sm leading-relaxed pl-3 border-l-2 border-ai-violet/40">
                {sections.exploreNext}
              </p>
            </div>
          )}

          {/* Fallback for raw text before streaming finishes */}
          {!sections && message.content && (
            <p className="text-text-primary whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {/* Embedded Scenario Proposal Card */}
        {proposal && onApproveProposal && onRejectProposal && (
          <ConfirmProposalDialog
            proposal={proposal}
            onApprove={onApproveProposal}
            onReject={onRejectProposal}
          />
        )}
      </div>
    </div>
  );
}
