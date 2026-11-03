import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import { useMoveMarker } from '../use-move-marker';
import { PLACEMENT_CLEARANCE } from '../../utils/placement';
import { placedItemZone } from '../../utils/site-zones';

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

  it('a drag onto another placed object is pushed out of its zone (PI-T3)', () => {
    const base = { name: 'Pump', category: 'water_pump' as const, sector: 'water' as const };
    const a = { ...base, id: 'a1', watts: 750, quantity: 1, position: { x: 30, z: 30 } };
    const b = { ...base, id: 'a2', watts: 750, quantity: 1 };
    useSimulationStore.getState().applyProposal({ appliances: [a, b] });
    const { result } = renderHook(() => useMoveMarker());
    act(() => result.current('a2', { x: 30, z: 30 }));
    const moved = useSimulationStore.getState().input.appliances![1]!;
    const zone = placedItemZone({ ...a })!;
    expect(Math.hypot(moved.position!.x - 30, moved.position!.z - 30)).toBeGreaterThanOrEqual(
      zone.r + PLACEMENT_CLEARANCE - 1e-9
    );
    // Dragging a line onto its own spot does not move it.
    act(() => result.current('a1', { x: 30, z: 30 }));
    expect(useSimulationStore.getState().input.appliances![0]!.position).toEqual({ x: 30, z: 30 });
  });
});
