import { useMemo, useState } from 'react';
import { clinicGuard, type ChangeImpact, type ClinicGuardReason } from '@mitsinjo/engine';
import { useSimulationStore } from '@/stores';
import { proposalImpact } from '@/lib/proposal-impact';
import type { CopilotProposal, ProposalDiffItem } from '../types';
import { pickProposal, type ProposalPick } from '../utils/proposal-parts';

export interface ProposalSelection {
  /** Checkboxes are shown only when the proposal has more than one line. */
  selectable: boolean;
  isChecked: (id: string | undefined) => boolean;
  toggle: (id: string) => void;
  /** Lines to apply / lines left out, in display order. */
  checkedItems: ProposalDiffItem[];
  skippedItems: ProposalDiffItem[];
  /** Part of the proposal the checked lines make up. */
  pick: ProposalPick;
  /** Engine before / after for the checked lines: the server's numbers when all are checked. */
  impact?: ChangeImpact;
  /** K6 rule on the checked lines only. */
  clinicReasons: ClinicGuardReason[];
}

/**
 * Per-line approval of a proposal (K3). Every line starts checked; unchecking one recomputes the
 * engine impact and the clinic guard for what is left, so the dialog never shows numbers for
 * changes that will not be applied.
 */
export function useProposalSelection(
  proposal: CopilotProposal,
  items: ProposalDiffItem[]
): ProposalSelection {
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(() => new Set());
  const input = useSimulationStore((s) => s.input);
  const activeStrategy = useSimulationStore((s) => s.activeStrategy);

  const selectable = items.length > 1 && items.every((item) => item.id !== undefined);
  const isChecked = (id: string | undefined) => !selectable || !id || !unchecked.has(id);
  const checkedItems = items.filter((item) => isChecked(item.id));
  const skippedItems = items.filter((item) => !isChecked(item.id));
  const partial = skippedItems.length > 0;
  const checkedKey = checkedItems.map((item) => item.id).join('|');

  const pick = useMemo<ProposalPick>(
    () =>
      partial
        ? pickProposal(proposal, checkedKey.split('|').filter(Boolean))
        : { patch: proposal.patch, strategy: proposal.strategy },
    [partial, proposal, checkedKey]
  );

  const impact = useMemo(() => {
    if (!partial) return proposal.impact;
    if (!pick.patch && !pick.strategy) return undefined;
    try {
      return proposalImpact(input, activeStrategy, pick.patch, pick.strategy).impact;
    } catch {
      return undefined;
    }
  }, [partial, proposal.impact, pick, input, activeStrategy]);

  const toggle = (id: string) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return {
    selectable,
    isChecked,
    toggle,
    checkedItems,
    skippedItems,
    pick,
    impact,
    clinicReasons: clinicGuard(pick.patch),
  };
}
