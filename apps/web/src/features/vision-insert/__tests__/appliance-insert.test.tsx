import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { APPLIANCE_CATALOG, applianceSummary } from '@mitsinjo/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import type { ApplianceDetection } from '@/lib/vision';
import { resetSimulationStore, selectActiveResult, useSimulationStore } from '@/stores';
import { useApplianceDraft } from '../hooks/use-appliance-draft';
import { ApplianceInsert } from '../ui/appliance-insert';

const pump: ApplianceDetection = {
  id: 'det-1',
  label: 'Water pump',
  category: 'water_pump',
  box: { x: 0.1, y: 0.1, w: 0.2, h: 0.3 },
};
const house: ApplianceDetection = {
  id: 'det-2',
  label: 'House',
  kind: 'scenery',
  category: 'other',
  scenery: 'building',
  box: { x: 0.5, y: 0.1, w: 0.3, h: 0.3 },
};

describe('useApplianceDraft (PV-T11)', () => {
  it('starts from the AI estimate; an edit turns it manual; AI estimate restores it', () => {
    const { result } = renderHook(() => useApplianceDraft('vision-p-det-1', pump, 'Water pump'));
    expect(result.current.source).toBe('ai');
    expect(result.current.draft).toMatchObject({
      category: 'water_pump',
      sector: 'water',
      watts: APPLIANCE_CATALOG.water_pump.defaultW,
      quantity: 1,
    });
    expect(result.current.summary).toEqual(applianceSummary(result.current.appliance!));
    act(() => result.current.setWatts(1200));
    expect(result.current.source).toBe('manual');
    expect(result.current.appliance?.watts).toBe(1200);
    act(() => result.current.setWatts(1e6));
    expect(result.current.appliance).toBeNull();
    expect(result.current.summary).toBeNull();
    act(() => result.current.applyAiEstimate());
    expect(result.current.source).toBe('ai');
    expect(result.current.draft.watts).toBe(APPLIANCE_CATALOG.water_pump.defaultW);
  });

  it('a new type keeps the watts inside its catalog range', () => {
    const { result } = renderHook(() => useApplianceDraft('x', pump, 'Pump'));
    act(() => result.current.setCategory('phone_charger'));
    expect(result.current.draft.watts).toBe(APPLIANCE_CATALOG.phone_charger.maxW);
    expect(result.current.range).toMatchObject({ minW: APPLIANCE_CATALOG.phone_charger.minW });
  });

  it('reopens an inserted line as it was (manual when it differs from the AI estimate)', () => {
    const existing = {
      id: 'x',
      name: 'Big pump',
      category: 'water_pump' as const,
      sector: 'water' as const,
      watts: 900,
      quantity: 2,
    };
    const { result } = renderHook(() => useApplianceDraft('x', pump, 'Pump', existing));
    expect(result.current.source).toBe('manual');
    expect(result.current.draft).toMatchObject({ name: 'Big pump', quantity: 2 });
  });
});

const renderInsert = (detection: ApplianceDetection, name: string) =>
  render(
    <I18nProvider>
      <ApplianceInsert detection={detection} name={name} photo="p1" />
    </I18nProvider>
  );

describe('ApplianceInsert (PV-T12)', () => {
  beforeEach(() => {
    resetSimulationStore();
    useSimulationStore.getState().run();
  });

  it('inserts the AI estimate, re-runs the simulation, then updates and removes it', () => {
    const before = selectActiveResult(useSimulationStore.getState())!.metrics.demandKwh;
    renderInsert(pump, 'Water pump');
    expect(screen.getByText(/^Engine: peak/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Insert into simulation' }));
    let s = useSimulationStore.getState();
    expect(s.input.appliances).toEqual([
      expect.objectContaining({ id: 'vision-p1-det-1', sector: 'water', quantity: 1 }),
    ]);
    const after = selectActiveResult(s)!.metrics.demandKwh;
    expect(after).toBeGreaterThan(before);
    expect(screen.getByRole('status').textContent).toContain('strategies re-computed');

    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } });
    expect(screen.getByRole('button', { name: 'Manual' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Update in simulation' }));
    s = useSimulationStore.getState();
    expect(s.input.appliances).toHaveLength(1);
    expect(s.input.appliances![0]!.quantity).toBe(3);

    fireEvent.click(screen.getByRole('button', { name: 'Remove from simulation' }));
    expect(useSimulationStore.getState().input.appliances).toBeUndefined();
    expect(selectActiveResult(useSimulationStore.getState())!.metrics.demandKwh).toBeCloseTo(
      before
    );
  });

  it('scenery can become a load by hand; out-of-range power blocks the insert', () => {
    renderInsert(house, 'House');
    expect(screen.getByText(/Scenery has no load by default/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Power per unit (W)'), { target: { value: '99999' } });
    expect(screen.getByText('Check the name and the power range.')).toBeTruthy();
    const insert = screen.getByRole('button', {
      name: 'Insert into simulation',
    }) as HTMLButtonElement;
    expect(insert.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Power per unit (W)'), { target: { value: '400' } });
    fireEvent.click(insert);
    expect(useSimulationStore.getState().input.appliances).toEqual([
      expect.objectContaining({ category: 'other', sector: 'households', watts: 400 }),
    ]);
  });
});
