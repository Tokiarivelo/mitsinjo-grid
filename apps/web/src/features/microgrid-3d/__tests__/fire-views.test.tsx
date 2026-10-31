import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { scenarios, simulate, type SimulationInput } from '@mitsinjo/engine';
import { I18nProvider } from '@/lib/i18n';
import { GridDiagram } from '../ui/grid-diagram';
import { toSceneModel } from '../utils/to-scene-model';
import { feederTone } from '../utils/feeder-tone';

const input: SimulationInput = {
  ...scenarios.baseline.input,
  events: [
    ...scenarios.baseline.input.events,
    { type: 'fire', sector: 'school', startHour: 10, durationH: 14 },
  ],
};
const result = simulate(input, 'proportional');

describe('fire in the scene model and the 2D views (M2-T3)', () => {
  it('marks the burning sector only while it burns, critical tone, 0 kW', () => {
    const before = toSceneModel({ input, result, timeIndex: 9 });
    const during = toSceneModel({ input, result, timeIndex: 12 });
    expect(before.buildings.school.onFire).toBe(false);
    expect(during.buildings.school.onFire).toBe(true);
    expect(during.buildings.market.onFire).toBe(false);
    expect(during.buildings.school.servedKw).toBe(0);
    expect(feederTone(during.controller.feeders.school, during.buildings.school)).toBe(
      'critical-red'
    );
  });

  it.each(['topology', 'circuit'] as const)('%s: the school card says "On fire"', (variant) => {
    const model = toSceneModel({ input, result, timeIndex: 12 });
    render(
      <I18nProvider>
        <GridDiagram model={model} variant={variant} onSelectSector={() => {}} />
      </I18nProvider>
    );
    const card = screen.getByRole('button', { name: /Primary School/ });
    expect(within(card).getAllByText('On fire').length).toBeGreaterThan(0);
    expect(
      within(screen.getByRole('button', { name: /Local Market/ })).queryByText('On fire')
    ).toBeNull();
  });
});
