import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetSimulationStore, usePlacedModelsStore, useSimulationStore } from '@/stores';
import { KEEP_OUT_ZONES } from '../../utils/landscape';
import { readSiteZones, usePlacedClearings, useSiteZones } from '../use-site-zones';

const pump = {
  id: 'a1',
  name: 'Pump',
  category: 'water_pump' as const,
  sector: 'water' as const,
  watts: 750,
  quantity: 1,
};

describe('site zones from the stores (PI-T3)', () => {
  beforeEach(() => {
    resetSimulationStore();
    usePlacedModelsStore.getState().clear();
  });

  it('readSiteZones = static zones + one per placed line', () => {
    expect(readSiteZones()).toHaveLength(KEEP_OUT_ZONES.length);
    useSimulationStore.getState().applyProposal({
      appliances: [
        { ...pump, position: { x: 30, z: 30 } },
        { ...pump, id: 'a2' },
      ],
    });
    const zones = readSiteZones();
    expect(zones).toHaveLength(KEEP_OUT_ZONES.length + 1);
    expect(zones.at(-1)).toMatchObject({ id: 'a1', x: 30, z: 30 });
  });

  it('useSiteZones follows the store', () => {
    const { result } = renderHook(() => useSiteZones());
    expect(result.current).toHaveLength(KEEP_OUT_ZONES.length);
    act(() =>
      useSimulationStore.getState().applyProposal({
        appliances: [{ ...pump, position: { x: 30, z: 30 } }],
      })
    );
    expect(result.current).toHaveLength(KEEP_OUT_ZONES.length + 1);
  });

  it('usePlacedClearings gives only the placed zones', () => {
    const { result } = renderHook(() =>
      usePlacedClearings([{ id: 'm1', category: 'fridge', position: [12, 0, -9] }])
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({ id: 'm1', x: 12, z: -9 });
  });
});
