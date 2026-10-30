import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { resetSimulationStore, useSimulationStore } from '@/stores';
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

  it('marks a cap that starts at the hour shown in the app as "starts now" (K2)', () => {
    useSimulationStore.setState({ timeIndex: 14 });
    const { result } = renderHook(() =>
      useProposalDiff({
        proposalId: 'P',
        reason: 'r',
        patch: { sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 14, toHour: 24 }] },
      })
    );
    expect(result.current[0]?.proposed).toBe('0 kW (14:00–24:00) · starts now');
  });
});
