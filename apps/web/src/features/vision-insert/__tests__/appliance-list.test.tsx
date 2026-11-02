import { fireEvent, render, screen } from '@testing-library/react';
import { applianceSummary, type Appliance } from '@mitsinjo/engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fmtKwh } from '@/lib/format';
import { I18nProvider } from '@/lib/i18n';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import { ApplianceList } from '../ui/appliance-list';

const pump: Appliance = {
  id: 'vision-p-det-1',
  name: 'Pump',
  category: 'water_pump',
  sector: 'water',
  watts: 750,
  quantity: 2,
};

const renderList = (props: Parameters<typeof ApplianceList>[0] = {}) =>
  render(
    <I18nProvider>
      <ApplianceList {...props} />
    </I18nProvider>
  );

describe('ApplianceList (PV-T13)', () => {
  beforeEach(() => {
    resetSimulationStore();
    useSimulationStore.getState().run();
  });

  it('empty: message and a link to the village editor', () => {
    renderList({ editorHref: '/village' });
    expect(screen.getByText('Appliances in the simulation (0/30)')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open the village editor' }).getAttribute('href')).toBe(
      '/village'
    );
  });

  it('lists each line with quantity × W, sector and engine kWh per day; remove re-runs', () => {
    useSimulationStore.getState().applyProposal({ appliances: [pump] });
    renderList({ editorHref: '/village' });
    const daily = fmtKwh(applianceSummary(pump).dailyKwh, 2);
    expect(screen.getByText(`2 × 750 W · Water Pumping Station · ${daily} per day`)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Edit Pump' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Pump from the simulation' }));
    expect(useSimulationStore.getState().input.appliances).toBeUndefined();
    expect(screen.getByText('No appliance added yet.')).toBeTruthy();
  });

  it('edit button calls back for lines this page can edit', () => {
    useSimulationStore.getState().applyProposal({ appliances: [pump] });
    const onEdit = vi.fn();
    renderList({ onEdit, canEdit: (id) => id === pump.id });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Pump' }));
    expect(onEdit).toHaveBeenCalledWith(pump.id);
  });
});
