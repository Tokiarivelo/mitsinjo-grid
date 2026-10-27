'use client';

import { CheckCircle2, XCircle, SlidersHorizontal, ArrowRight } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { useSimulationStore } from '@/stores';
import { cn } from '@/lib/utils';
import type { CopilotProposal } from '../types';

export interface ConfirmProposalDialogProps {
  proposal: CopilotProposal;
  onApprove: () => void;
  onReject: () => void;
  className?: string;
}

export function ConfirmProposalDialog({
  proposal,
  onApprove,
  onReject,
  className,
}: ConfirmProposalDialogProps) {
  const tCopilot = useTranslations('features.copilot');
  const currentInput = useSimulationStore((s) => s.input);
  const currentStrategy = useSimulationStore((s) => s.activeStrategy);

  const patch = proposal.patch;

  // Build diff list
  const diffItems: { label: string; current: string; proposed: string }[] = [];

  if (proposal.strategy !== undefined) {
    diffItems.push({
      label: tCopilot('diffDispatchPolicy'),
      current: currentStrategy,
      proposed: proposal.strategy,
    });
  }

  if (patch?.solarDropPct !== undefined) {
    diffItems.push({
      label: tCopilot('diffSolarDrop'),
      current: '0%',
      proposed: `${patch.solarDropPct}%`,
    });
  }
  if (patch?.dropStartHour !== undefined || patch?.dropDurationH !== undefined) {
    const start = patch?.dropStartHour ?? 12;
    const dur = patch?.dropDurationH ?? 2;
    diffItems.push({
      label: tCopilot('diffDropWindow'),
      current: 'None',
      proposed: `${start}:00 - ${start + dur}:00 (${dur}h)`,
    });
  }
  if (patch?.demandMultiplier !== undefined) {
    diffItems.push({
      label: tCopilot('diffDemandMultiplier'),
      current: `${currentInput.demandMultiplier}x`,
      proposed: `${patch.demandMultiplier}x`,
    });
  }
  if (patch?.batteryCapacityKwh !== undefined) {
    diffItems.push({
      label: tCopilot('diffBatteryCapacity'),
      current: `${currentInput.battery.capacityKwh} kWh`,
      proposed: `${patch.batteryCapacityKwh} kWh`,
    });
  }
  if (patch?.initialSocPct !== undefined) {
    diffItems.push({
      label: tCopilot('diffInitialSoc'),
      current: `${currentInput.battery.initialSocPct}%`,
      proposed: `${patch.initialSocPct}%`,
    });
  }
  if (patch?.minSocPct !== undefined) {
    diffItems.push({
      label: tCopilot('diffMinSoc'),
      current: `${currentInput.battery.minSocPct}%`,
      proposed: `${patch.minSocPct}%`,
    });
  }

  return (
    <div
      role="dialog"
      aria-labelledby={`proposal-title-${proposal.proposalId}`}
      aria-modal="true"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onReject();
        }
      }}
      className={cn(
        'bg-surface-elevated border-2 border-ai-violet/40 rounded-xl p-5 shadow-[0_0_24px_-4px_rgba(182,160,255,0.18)] flex flex-col gap-4 text-xs font-sans animate-in fade-in duration-200',
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-ai-violet" aria-hidden="true" />
          <span
            id={`proposal-title-${proposal.proposalId}`}
            className="font-display text-sm font-semibold text-text-primary tracking-wide uppercase"
          >
            {tCopilot('proposalTitle')}
          </span>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-ai-violet/15 text-ai-violet border border-ai-violet/40 font-semibold tracking-wider">
          {proposal.proposalId}
        </span>
      </div>

      {/* Justification reason */}
      <div className="p-2.5 rounded bg-surface border border-border/50 text-text-secondary leading-relaxed">
        <span className="text-[10px] font-mono text-text-muted uppercase block mb-1">
          {tCopilot('proposalReason')}
        </span>
        <p className="text-text-primary font-medium">{proposal.reason}</p>
      </div>

      {/* Parameter Diff Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 font-mono">
        {diffItems.map((item, idx) => (
          <div
            key={idx}
            className="p-2.5 rounded-lg bg-surface border border-border/40 flex flex-col justify-between"
          >
            <span className="text-[10px] text-text-muted uppercase truncate">
              {item.label}
            </span>
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-xs">
              <span className="line-through text-text-muted/70">
                {item.current}
              </span>
              <ArrowRight className="h-3 w-3 text-energy-cyan shrink-0" aria-hidden="true" />
              <span className="text-secondary font-semibold bg-energy-cyan/10 px-1.5 py-0.5 rounded border border-energy-cyan/30 text-energy-cyan">
                {item.proposed}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/40">
        <Button
          variant="secondary"
          size="sm"
          onClick={onReject}
          icon={<XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          {tCopilot('proposalReject')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onApprove}
          icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          {tCopilot('proposalApprove')}
        </Button>
      </div>
    </div>
  );
}
