import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { resetSimulationStore } from '@/stores';
import { useProposalDiff } from '../use-proposal-diff';

describe('useProposalDiff', () => {
  beforeEach(() => resetSimulationStore());

  it('lists each changed setting as current → proposed, translated', () => {
    const { result } = renderHook(() =>
      useProposalDiff({
        proposalId: 'P',
        reason: 'r',
        strategy: 'essential_first',
        patch: {
          sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 18, toHour: 22 }],
          dropStartHour: 13,
          dropDurationH: 2,
          sectorLoads: { health: 0 },
        },
      })
    );
    expect(result.current).toEqual([
      {
        label: 'Dispatch Strategy',
        current: 'Proportional Allocation',
        proposed: 'Essential-First Priority',
      },
      {
        label: 'Local Market & Artisans Capacity Cap',
        current: 'None (uncapped)',
        proposed: '0 kW (18:00–22:00)',
      },
      { label: 'Drop Window', current: 'None', proposed: '13:00–15:00 (2 h)' },
      { label: 'Health Clinic Load', current: '1×', proposed: 'Not connected' },
    ]);
  });
});
