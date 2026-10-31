import { CheckCircle2, Undo2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ProposalDecision, ProposalDecisionStatus } from '../types';
import { ProposalDiffList, ProposalSkippedList } from './proposal-diff-list';

export interface ProposalDecisionMessageProps {
  decision: ProposalDecision;
  timestamp?: string;
  /** Only on the last approved change still applied: shows "Undo last change". */
  onUndo?: () => void;
  className?: string;
}

/** Icon per decision status (shared with the proposal card badge). */
export const DECISION_ICON: Record<ProposalDecisionStatus, typeof CheckCircle2> = {
  approved: CheckCircle2,
  rejected: XCircle,
  undone: Undo2,
};

/** Chat entry posted after the operator approves, rejects or undoes a proposal, with the settings concerned. */
export function ProposalDecisionMessage({
  decision,
  timestamp,
  onUndo,
  className,
}: ProposalDecisionMessageProps) {
  const t = useTranslations('features.copilot.decision');
  const { status } = decision;
  const approved = status === 'approved';
  const Icon = DECISION_ICON[status];

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
          <p className="font-semibold text-text-primary">{t(`${status}Title`)}</p>
          <p className="text-text-secondary mt-0.5">{t(`${status}Body`)}</p>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0 font-mono text-[10px] text-text-muted">
          <span>{decision.proposalId}</span>
          {timestamp && <span>{timestamp}</span>}
        </div>
      </div>
      <ProposalDiffList items={decision.items} tone="muted" />
      <ProposalSkippedList items={decision.skipped} />
      {onUndo && (
        <div className="flex @md:justify-end pt-2 border-t border-border/40">
          <Button
            variant="secondary"
            size="sm"
            onClick={onUndo}
            icon={<Undo2 className="h-3.5 w-3.5" aria-hidden="true" />}
            className="w-full @md:w-auto min-h-11 justify-center"
          >
            {t('undoLast')}
          </Button>
        </div>
      )}
    </div>
  );
}
