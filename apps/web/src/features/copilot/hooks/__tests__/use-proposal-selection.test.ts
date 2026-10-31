import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { SectorCap } from '@mitsinjo/engine';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import { proposalImpact } from '@/lib/proposal-impact';
import type { CopilotProposal, ProposalDiffItem } from '../../types';
import { useProposalSelection } from '../use-proposal-selection';

const caps: SectorCap[] = [
  { sector: 'market', maxKw: 0, fromHour: 8, toHour: 18 },
  { sector: 'health', maxKw: 0, fromHour: 8, toHour: 18 },
];
const items: ProposalDiffItem[] = [
  { id: 'sectorCaps.0', label: 'Market cap', current: 'None', proposed: '0 kW' },
  { id: 'sectorCaps.1', label: 'Clinic cap', current: 'None', proposed: '0 kW' },
];

describe('useProposalSelection (K3)', () => {
  beforeEach(() => resetSimulationStore());

  function setup() {
    const { input, activeStrategy } = useSimulationStore.getState();
    const full = proposalImpact(input, activeStrategy, { sectorCaps: caps }).impact;
    const proposal: CopilotProposal = {
      proposalId: 'P',
      reason: 'r',
      patch: { sectorCaps: caps },
      impact: full,
    };
    return { proposal, full, input, activeStrategy };
  }

  it('starts with every line checked and the server impact', () => {
    const { proposal, full } = setup();
    const { result } = renderHook(() => useProposalSelection(proposal, items));
    expect(result.current.selectable).toBe(true);
    expect(result.current.checkedItems).toEqual(items);
    expect(result.current.skippedItems).toEqual([]);
    expect(result.current.impact).toBe(full);
    expect(result.current.clinicReasons).toEqual(['cap_zero']);
  });

  it('unchecking a line recomputes impact and clinic guard for what is left', () => {
    const { proposal, input, activeStrategy } = setup();
    const { result } = renderHook(() => useProposalSelection(proposal, items));
    act(() => result.current.toggle('sectorCaps.1'));

    expect(result.current.skippedItems.map((i) => i.id)).toEqual(['sectorCaps.1']);
    expect(result.current.pick).toEqual({ patch: { sectorCaps: [caps[0]] } });
    expect(result.current.clinicReasons).toEqual([]);
    expect(result.current.impact).toEqual(
      proposalImpact(input, activeStrategy, { sectorCaps: [caps[0]!] }).impact
    );
  });

  it('nothing checked → no impact; one-line proposals have no checkboxes', () => {
    const { proposal } = setup();
    const { result } = renderHook(() => useProposalSelection(proposal, items));
    act(() => result.current.toggle('sectorCaps.0'));
    act(() => result.current.toggle('sectorCaps.1'));
    expect(result.current.checkedItems).toEqual([]);
    expect(result.current.impact).toBeUndefined();

    const single = renderHook(() => useProposalSelection(proposal, [items[0]!]));
    expect(single.result.current.selectable).toBe(false);
  });
});
