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
        id: 'strategy',
        label: 'Dispatch Strategy',
        current: 'Proportional Allocation',
        proposed: 'Essential-First Priority',
      },
      {
        id: 'sectorCaps.0',
        label: 'Local Market & Artisans Capacity Cap',
        current: 'None (uncapped)',
        proposed: '0 kW (18:00–22:00)',
      },
      { id: 'dropWindow', label: 'Drop Window', current: 'None', proposed: '13:00–15:00 (2 h)' },
      {
        id: 'sectorLoads.health',
        label: 'Health Clinic Load',
        current: '1×',
        proposed: 'Not connected',
      },
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

  it('appliance lines show feeder + load with aligned ids, removals last (PV-T11b)', () => {
    useSimulationStore.getState().applyProposal({
      appliances: [
        {
          id: 'a1',
          name: 'Pump',
          category: 'water_pump',
          sector: 'water',
          watts: 750,
          quantity: 1,
        },
        { id: 'a2', name: 'Lamp', category: 'lamp', sector: 'households', watts: 10, quantity: 2 },
      ],
    });
    const { result } = renderHook(() =>
      useProposalDiff({
        proposalId: 'P',
        reason: 'r',
        patch: {
          appliances: [
            {
              id: 'a1',
              name: 'Pump',
              category: 'water_pump',
              sector: 'water',
              watts: 900,
              quantity: 1,
              position: { x: 30, z: 30 },
            },
            {
              id: 'a3',
              name: 'TV',
              category: 'tv',
              sector: 'households',
              watts: 80,
              quantity: 1,
            },
          ],
        },
      })
    );
    expect(result.current).toEqual([
      {
        id: 'appliances.a1',
        label: 'Pump',
        current: 'Water Pumping Station · 750 W × 1',
        proposed: 'Water Pumping Station · 900 W × 1 · (30, 30)',
      },
      {
        id: 'appliances.a3',
        label: 'TV',
        current: 'None',
        proposed: 'Village Households · 80 W × 1',
      },
      {
        id: 'appliances.a2',
        label: 'Lamp',
        current: 'Village Households · 10 W × 2',
        proposed: 'Removed',
      },
    ]);
  });

  it('fire restore lines show the cut range → restored, with aligned ids (M2-T4)', () => {
    useSimulationStore.setState({ timeIndex: 14 });
    useSimulationStore.getState().reportFire('school');
    const { result } = renderHook(() =>
      useProposalDiff({
        proposalId: 'P',
        reason: 'r',
        patch: { clearFires: ['school'] },
      })
    );
    expect(result.current).toEqual([
      {
        id: 'clearFires.school',
        label: 'Primary School Fire restore',
        current: 'Cut 14:00–24:00',
        proposed: 'Power restored',
      },
    ]);
  });

  it('restore without a burning fire shows None as current (M2-T4)', () => {
    const { result } = renderHook(() =>
      useProposalDiff({
        proposalId: 'P',
        reason: 'r',
        patch: { clearFires: ['market'] },
      })
    );
    expect(result.current).toEqual([
      {
        id: 'clearFires.market',
        label: 'Local Market & Artisans Fire restore',
        current: 'None',
        proposed: 'Power restored',
      },
    ]);
  });
});
