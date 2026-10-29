import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { SECTOR_IDS } from '@mitsinjo/engine';
import { initialSimulationData, useSimulationStore } from '@/stores';
import { SECTOR_LOAD_MAX, useSectorLoads } from '../hooks/use-sector-loads';

const factoryInput = () =>
  useSimulationStore.getState().input.sectors.find((s) => s.id === 'industry')!;

beforeEach(() => {
  useSimulationStore.setState(initialSimulationData);
});

describe('useSectorLoads', () => {
  it('lists every sector; the factory starts not connected', () => {
    const { result } = renderHook(() => useSectorLoads());
    expect(result.current.rows.map((r) => r.id)).toEqual([...SECTOR_IDS]);
    const factory = result.current.rows.find((r) => r.id === 'industry')!;
    expect(factory).toMatchObject({ load: 0, connected: false });
    expect(result.current.rows.find((r) => r.id === 'health')).toMatchObject({
      load: 1,
      connected: true,
    });
  });

  it('connecting the factory re-runs the simulation at once (live, no Run click)', () => {
    const { result } = renderHook(() => useSectorLoads());
    act(() => result.current.setLoad('industry', 1));
    const state = useSimulationStore.getState();
    expect(state.status).toBe('complete');
    // Load 1 is the implicit default (kept out of the input so its hash stays stable).
    expect(factoryInput().loadMultiplier ?? 1).toBe(1);
    const served = Object.values(state.results)[0]!;
    expect(served.metrics.perSector.industry!.demandKwh).toBeGreaterThan(0);
    expect(result.current.rows.find((r) => r.id === 'industry')!.connected).toBe(true);
  });

  it('keeps the timeline playing while the load changes', () => {
    const { result } = renderHook(() => useSectorLoads());
    act(() => useSimulationStore.getState().play());
    act(() => result.current.setLoad('market', 2));
    expect(useSimulationStore.getState().isPlaying).toBe(true);
  });

  it('clamps to the engine bounds and rounds to the slider step', () => {
    const { result } = renderHook(() => useSectorLoads());
    act(() => result.current.setLoad('industry', 9));
    expect(factoryInput().loadMultiplier).toBe(SECTOR_LOAD_MAX);
    act(() => result.current.setLoad('industry', 0.3000000004));
    expect(factoryInput().loadMultiplier).toBe(0.3);
    act(() => result.current.setLoad('industry', -2));
    expect(factoryInput().loadMultiplier).toBe(0);
  });
});
