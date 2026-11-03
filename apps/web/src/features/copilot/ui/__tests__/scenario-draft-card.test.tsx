import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScenarioDraftCard } from '../scenario-draft-card';
import type { ScenarioDraftPayload } from '../../types';
import { useSimulationStore } from '@/stores';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('ScenarioDraftCard (PA-T8e)', () => {
  it('renders target example with missing fire hour and suggested pills', () => {
    const onUpdate = vi.fn();
    const payload: ScenarioDraftPayload = {
      draft: {
        title: 'Draft 3 Days',
        days: [
          { day: 1, weather: 'cloudy' },
          { day: 2, weather: 'rainy' },
          {
            day: 3,
            weather: 'sunny',
            events: [
              {
                type: 'fire',
                sector: 'school',
              },
            ],
          },
        ],
      },
      missingSlots: [
        {
          kind: 'missing_fire_hour',
          day: 3,
          eventIndex: 0,
          messageKey: 'missingFireHour',
          suggestedResponses: [
            { label: '08:00', value: 8 },
            { label: '12:00', value: 12 },
            { label: '14:00', value: 14 },
            { label: '16:00', value: 16 },
          ],
        },
      ],
      isComplete: false,
    };

    render(<ScenarioDraftCard payload={payload} onUpdateDraft={onUpdate} />);

    expect(screen.getByText('Draft 3 Days')).toBeInTheDocument();
    expect(screen.getByText('1 missing item(s)')).toBeInTheDocument();
    expect(screen.getByText('Day 1')).toBeInTheDocument();
    expect(screen.getByText('Day 2')).toBeInTheDocument();
    expect(screen.getByText('Day 3')).toBeInTheDocument();

    // Option pills
    const pill14 = screen.getByRole('button', { name: '14:00' });
    expect(pill14).toBeInTheDocument();

    fireEvent.click(pill14);
    expect(onUpdate).toHaveBeenCalled();
  });

  it('renders engine preview and launches simulation in autonomous AI mode when complete', () => {
    const payload: ScenarioDraftPayload = {
      draft: {
        title: 'Complete 3 Days',
        days: [
          { day: 1, weather: 'cloudy' },
          { day: 2, weather: 'rainy' },
          {
            day: 3,
            weather: 'sunny',
            events: [
              {
                type: 'fire',
                sector: 'school',
                startHour: 14,
                durationH: 10,
              },
            ],
          },
        ],
      },
      missingSlots: [],
      isComplete: true,
      preview: {
        worstDay: 3,
        totalDeficitKwh: 18.5,
        criticalUnservedKwh: 2.4,
        dayDeficits: [
          { day: 1, deficitKwh: 0 },
          { day: 2, deficitKwh: 4.2 },
          { day: 3, deficitKwh: 14.3 },
        ],
      },
    };

    render(<ScenarioDraftCard payload={payload} />);

    expect(screen.getByText('Complete 3 Days')).toBeInTheDocument();
    expect(screen.getByText('Engine Simulation Preview')).toBeInTheDocument();
    expect(screen.getByText('18.5 kWh')).toBeInTheDocument();
    expect(screen.getByText('2.4 kWh')).toBeInTheDocument();

    const launchAutoBtn = screen.getByRole('button', {
      name: /launch in autonomous ai mode/i,
    });
    expect(launchAutoBtn).toBeInTheDocument();

    fireEvent.click(launchAutoBtn);

    const store = useSimulationStore.getState();
    expect(store.dispatchMode).toBe('autonomous');
    expect(store.workflow).toHaveLength(3);
    expect(mockPush).toHaveBeenCalledWith('/simulation');
  });

  it('answering the last missing slot clears it and shows the launch buttons (PR #44 review)', () => {
    const payload: ScenarioDraftPayload = {
      draft: {
        days: [
          { day: 1 },
          { day: 2, weather: 'sunny', events: [{ type: 'fire', sector: 'school' }] },
        ],
      },
      missingSlots: [],
      isComplete: false,
    };
    render(<ScenarioDraftCard payload={payload} />);

    expect(screen.getByText('2 missing item(s)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Launch Simulation/i })).toBeNull();

    // Weather pills use the localized weather names.
    fireEvent.click(screen.getByRole('button', { name: 'Cloudy' }));
    expect(screen.getByText('1 missing item(s)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '12:00' }));
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Launch Simulation/i })).toBeInTheDocument();
  });
});
