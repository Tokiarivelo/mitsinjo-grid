import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import { OverviewPage } from '../index';

describe('OverviewPage — incident screen', () => {
  beforeEach(() => {
    resetSimulationStore();
  });

  it('starts empty with the simulated notice and both start buttons', () => {
    render(<OverviewPage />);
    expect(screen.getByText('SIMULATED DATA')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: /what happens when the sun drops/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run simulation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /simulate a solar drop/i })).toBeInTheDocument();
    // No rings before a run
    expect(screen.queryByRole('heading', { name: /same day, different decision/i })).toBeNull();
  });

  it('shows "all clear" on the baseline day', () => {
    render(<OverviewPage />);
    fireEvent.click(screen.getByRole('button', { name: /run simulation/i }));

    expect(useSimulationStore.getState().status).toBe('complete');
    expect(
      screen.getByRole('heading', { level: 1, name: /every essential service stays on/i })
    ).toBeInTheDocument();
  });

  it('solar drop → incident with start hour, copilot CTA and strategy rings', () => {
    render(<OverviewPage />);
    fireEvent.click(screen.getByRole('button', { name: /simulate a solar drop/i }));

    const state = useSimulationStore.getState();
    expect(state.scenarioId).toBe('cloudy_afternoon');
    const crit = state.results[state.activeStrategy]!.warnings.find(
      (w) => w.code === 'CRITICAL_UNMET'
    )!;
    const hour = `${String(crit.fromHour).padStart(2, '0')}:00`;

    expect(
      screen.getByRole('heading', { level: 1, name: new RegExp(`go dark at ${hour}`) })
    ).toBeInTheDocument();
    // The twin jumps to the outage hour
    expect(state.timeIndex).toBe(crit.fromHour);
    expect(screen.getByRole('link', { name: /ask the copilot why/i })).toHaveAttribute(
      'href',
      '/copilot'
    );
    expect(
      screen.getByRole('heading', { name: /same day, different decision/i })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /essential coverage with/i })).toHaveLength(3);
  });

  it('"See the village at" moves the timeline to the outage hour', () => {
    useSimulationStore.getState().loadScenario('cloudy_afternoon');
    useSimulationStore.getState().run();
    useSimulationStore.getState().setTimeIndex(6);
    render(<OverviewPage />);

    fireEvent.click(screen.getByRole('button', { name: /see the village at/i }));
    expect(useSimulationStore.getState().timeIndex).not.toBe(6);
  });

  it('changing scenario recomputes right away', () => {
    render(<OverviewPage />);
    fireEvent.change(screen.getByLabelText(/select simulation scenario/i), {
      target: { value: 'cloudy_afternoon' },
    });
    const state = useSimulationStore.getState();
    expect(state.scenarioId).toBe('cloudy_afternoon');
    expect(state.status).toBe('complete');
  });
});
