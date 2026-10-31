'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, SlidersHorizontal } from 'lucide-react';
import { clinicGuard } from '@mitsinjo/engine';
import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  CopilotProposal,
  ProposalDecision,
  ProposalDecisionStatus,
  ProposalDiffItem,
} from '../types';
import { useProposalDiff } from '../hooks/use-proposal-diff';
import { ProposalImpact } from './proposal-impact';
import { ClinicGuardWarning } from './clinic-guard-warning';
import { DECISION_ICON } from './proposal-decision-message';
import { ProposalDiffList } from './proposal-diff-list';

export interface ConfirmProposalDialogProps {
  proposal: CopilotProposal;
  /** Called with the settings as shown (snapshot taken before the change is applied). */
  onApprove: (items: ProposalDiffItem[]) => void;
  onReject: (items: ProposalDiffItem[]) => void;
  /** Set once the operator decided: the card locks, its buttons go away, values as decided. */
  decision?: ProposalDecision;
  className?: string;
}

export function ConfirmProposalDialog({
  proposal,
  onApprove,
  onReject,
  decision,
  className,
}: ConfirmProposalDialogProps) {
  const t = useTranslations('features.copilot');
  const liveItems = useProposalDiff(proposal);
  // After approval the simulation already holds the new values: show the snapshot instead.
  const items = decision?.items ?? liveItems;

  // K6: the rule runs here in code, whatever the model said. Unsafe → first click arms, second click approves.
  const clinicReasons = clinicGuard(proposal.patch);
  const needsSecondConfirm = clinicReasons.length > 0;
  const [armed, setArmed] = useState(false);
  const open = decision === undefined;

  const handleApprove = () => {
    if (needsSecondConfirm && !armed) {
      setArmed(true);
      return;
    }
    onApprove(items);
  };

  return (
    <div
      role={open ? 'dialog' : 'group'}
      aria-labelledby={`proposal-title-${proposal.proposalId}`}
      aria-modal={open ? 'false' : undefined}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (open && e.key === 'Escape') {
          e.stopPropagation();
          onReject(items);
        }
      }}
      className={cn(
        '@container bg-surface-elevated border-2 rounded-xl p-3 @md:p-5 flex flex-col gap-3 @md:gap-4 text-xs font-sans animate-in fade-in duration-200',
        open ? 'border-ai-violet/40 shadow-lg shadow-ai-violet/10' : 'border-border/60',
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-ai-violet" aria-hidden="true" />
          <span
            id={`proposal-title-${proposal.proposalId}`}
            className="font-display text-xs @md:text-sm font-semibold text-text-primary tracking-wide uppercase"
          >
            {t('proposalTitle')}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {decision && <DecisionBadge status={decision.status} />}
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-ai-violet/15 text-ai-violet border border-ai-violet/40 font-semibold tracking-wider">
            {proposal.proposalId}
          </span>
        </div>
      </div>

      {/* Justification reason */}
      <div className="p-2.5 rounded bg-surface border border-border/50 leading-relaxed">
        <span className="text-[10px] font-mono text-text-muted uppercase block mb-1">
          {t('proposalReason')}
        </span>
        <p className="text-text-primary font-medium">{proposal.reason}</p>
      </div>

      <ProposalDiffList items={items} tone={open ? 'active' : 'muted'} />

      {open && needsSecondConfirm && <ClinicGuardWarning reasons={clinicReasons} armed={armed} />}

      {/* Engine before/after (K1) */}
      {proposal.impact && <ProposalImpact impact={proposal.impact} />}

      {/* Actions: a short list when the card is narrow, one row when wide. Gone once decided. */}
      {open && (
        <div className="flex flex-col-reverse @md:flex-row @md:justify-end gap-2 pt-3 border-t border-border/40">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onReject(items)}
            icon={<XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
            className="w-full @md:w-auto min-h-11 justify-center"
          >
            {t('proposalReject')}
          </Button>
          <Button
            variant={needsSecondConfirm ? 'danger' : 'primary'}
            size="sm"
            onClick={handleApprove}
            icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
            className="w-full @md:w-auto min-h-11 justify-center text-center"
          >
            {armed ? t('clinicGuard.confirmAgain') : t('proposalApprove')}
          </Button>
        </div>
      )}
    </div>
  );
}

/** "Approved" / "Rejected" chip: color + icon + text. */
export function DecisionBadge({ status }: { status: ProposalDecisionStatus }) {
  const t = useTranslations('features.copilot');
  const approved = status === 'approved';
  const Icon = DECISION_ICON[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider border',
        approved
          ? 'bg-battery-green/10 text-battery-green border-battery-green/40'
          : 'bg-surface text-text-secondary border-border'
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {t(`decision.${status}Badge`)}
    </span>
  );
}
