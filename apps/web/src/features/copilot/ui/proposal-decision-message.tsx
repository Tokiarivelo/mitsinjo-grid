import { CheckCircle2, XCircle } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ProposalDecision } from '../types';
import { ProposalDiffList } from './proposal-diff-list';

export interface ProposalDecisionMessageProps {
  decision: ProposalDecision;
  timestamp?: string;
  className?: string;
}

/** Chat entry posted after the operator approves or rejects a proposal, with the settings concerned. */
export function ProposalDecisionMessage({
  decision,
  timestamp,
  className,
}: ProposalDecisionMessageProps) {
  const t = useTranslations('features.copilot.decision');
  const approved = decision.status === 'approved';
  const Icon = approved ? CheckCircle2 : XCircle;

  return (
    <div
      role="status"
      className={cn(
        '@container w-full max-w-3xl mx-auto rounded-xl border p-3 flex flex-col gap-2.5 text-xs',
        approved ? 'bg-battery-green/5 border-battery-green/40' : 'bg-surface border-border',
        className
      )}
    >
      <div className="flex items-start gap-2">
        <Icon
          className={cn(
            'h-4 w-4 mt-0.5 shrink-0',
            approved ? 'text-battery-green' : 'text-text-secondary'
          )}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text-primary">
            {approved ? t('approvedTitle') : t('rejectedTitle')}
          </p>
          <p className="text-text-secondary mt-0.5">
            {approved ? t('approvedBody') : t('rejectedBody')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0 font-mono text-[10px] text-text-muted">
          <span>{decision.proposalId}</span>
          {timestamp && <span>{timestamp}</span>}
        </div>
      </div>
      <ProposalDiffList items={decision.items} tone="muted" />
    </div>
  );
}
