import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import { useMoveMarker } from '../use-move-marker';

describe('useMoveMarker (PP-T5)', () => {
  beforeEach(() => {
    resetSimulationStore();
  });

  it('moves the line (feeder follows), keeps the rest, ignores unknown ids', () => {
    const pump = {
      id: 'a1',
      name: 'Pump',
      category: 'water_pump' as const,
      sector: 'water' as const,
      watts: 750,
      quantity: 1,
    };
    const fridge = { ...pump, id: 'a2', name: 'Fridge', category: 'fridge' as const, watts: 120 };
    useSimulationStore.getState().applyProposal({ appliances: [pump, fridge] });
    const { result } = renderHook(() => useMoveMarker());
    act(() => result.current('a1', { x: 30, z: 30 }));
    const [moved, kept] = useSimulationStore.getState().input.appliances!;
    expect(moved).toMatchObject({ id: 'a1', position: { x: 30, z: 30 }, sector: 'market' });
    expect(kept).toMatchObject({ id: 'a2' });
    expect(kept).not.toHaveProperty('position');
    act(() => result.current('ghost', { x: 0, z: 0 }));
    expect(useSimulationStore.getState().input.appliances).toHaveLength(2);
  });
});
