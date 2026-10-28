import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_WORKFLOW_DAYS, compareWorkflow, createBaselineInput } from '@mitsinjo/engine';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import { SimulationPage } from '../index';
import { WeatherWorkflowPanel } from '../ui/weather-workflow-panel';
import { DayStrip } from '../ui/day-strip';
import { WeatherPill } from '../ui/weather-pill';

const noop = () => {};

describe('WeatherPill', () => {
  it('renders as a toggle button by default and as a radio inside a group', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <WeatherPill weather="cloudy" label="Cloudy" selected onClick={onClick} />
    );
    const btn = screen.getByRole('button', { name: 'Cloudy' });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<WeatherPill weather="rainy" label="Rainy" role="radio" selected={false} />);
    expect(screen.getByRole('radio', { name: 'Rainy' })).toHaveAttribute('aria-checked', 'false');
  });
});

describe('WeatherWorkflowPanel', () => {
  it('renders one weather radiogroup per day with the selected weather checked', () => {
    render(
      <WeatherWorkflowPanel
        workflow={[{ weather: 'sunny' }, { weather: 'cloudy' }]}
        dayIndex={0}
        onAddDay={noop}
        onRemoveDay={noop}
        onSetWeather={noop}
        onSelectDay={noop}
      />
    );
    const day2 = screen.getByRole('radiogroup', { name: 'Weather for Day 2' });
    expect(within(day2).getAllByRole('radio')).toHaveLength(5);
    expect(within(day2).getByRole('radio', { name: 'Cloudy' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('calls back on weather change, add and remove', () => {
    const onSetWeather = vi.fn();
    const onAddDay = vi.fn();
    const onRemoveDay = vi.fn();
    render(
      <WeatherWorkflowPanel
        workflow={[{ weather: 'sunny' }, { weather: 'cloudy' }]}
        dayIndex={0}
        onAddDay={onAddDay}
        onRemoveDay={onRemoveDay}
        onSetWeather={onSetWeather}
        onSelectDay={noop}
      />
    );
    const day1 = screen.getByRole('radiogroup', { name: 'Weather for Day 1' });
    fireEvent.click(within(day1).getByRole('radio', { name: 'Storm' }));
    expect(onSetWeather).toHaveBeenCalledWith(0, 'storm');

    fireEvent.click(screen.getByRole('button', { name: 'Add day' }));
    expect(onAddDay).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Day 2' }));
    expect(onRemoveDay).toHaveBeenCalledWith(1);
  });

  it('hides remove on a single day and disables add at the max', () => {
    const { rerender } = render(
      <WeatherWorkflowPanel
        workflow={[{ weather: 'sunny' }]}
        dayIndex={0}
        onAddDay={noop}
        onRemoveDay={noop}
        onSetWeather={noop}
        onSelectDay={noop}
      />
    );
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();

    rerender(
      <WeatherWorkflowPanel
        workflow={Array.from({ length: MAX_WORKFLOW_DAYS }, () => ({ weather: 'sunny' as const }))}
        dayIndex={0}
        onAddDay={noop}
        onRemoveDay={noop}
        onSetWeather={noop}
        onSelectDay={noop}
      />
    );
    expect(screen.getByRole('button', { name: 'Add day' })).toBeDisabled();
  });

  it('shows engine totals for a multi-day result', () => {
    const workflow = [{ weather: 'sunny' as const }, { weather: 'storm' as const }];
    const wf = compareWorkflow(createBaselineInput(), workflow, ['proportional']).proportional!;
    render(
      <WeatherWorkflowPanel
        workflow={workflow}
        dayIndex={0}
        workflowResult={wf}
        onAddDay={noop}
        onRemoveDay={noop}
        onSetWeather={noop}
        onSelectDay={noop}
      />
    );
    expect(screen.getByText(`${wf.totals.unservedKwh.toFixed(1)} kWh`)).toBeInTheDocument();
    expect(screen.getByText('Unserved (all days)')).toBeInTheDocument();
  });
});

describe('DayStrip', () => {
  it('marks the current day and flags days with a critical deficit', () => {
    const workflow = [{ weather: 'sunny' as const }, { weather: 'storm' as const }];
    const input = createBaselineInput();
    input.battery.initialSocPct = 25;
    const wf = compareWorkflow(input, workflow, ['proportional']).proportional!;
    const onSelectDay = vi.fn();
    render(
      <DayStrip workflow={workflow} dayIndex={0} workflowResult={wf} onSelectDay={onSelectDay} />
    );
    expect(screen.getByRole('button', { name: /^Day 1: Sunny/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    const day2 = screen.getByRole('button', { name: /Day 2: Storm/ });
    expect(day2).toHaveAttribute('aria-pressed', 'false');
    expect(wf.days[1]!.result.metrics.criticalUnservedKwh).toBeGreaterThan(0.05);
    expect(day2).toHaveAccessibleName('Day 2: Storm, essential services short');
    fireEvent.click(day2);
    expect(onSelectDay).toHaveBeenCalledWith(1);
  });
});

describe('SimulationPage weather workflow', () => {
  beforeEach(() => {
    resetSimulationStore();
  });

  it('builds a 2-day workflow from the Controls tab and switches days from the day strip', () => {
    render(<SimulationPage />);
    fireEvent.click(screen.getByRole('tab', { name: /controls/i }));
    expect(screen.getByText('Weather workflow')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Simulated days' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add day' }));
    const day2 = screen.getByRole('radiogroup', { name: 'Weather for Day 2' });
    fireEvent.click(within(day2).getByRole('radio', { name: 'Cloudy' }));
    expect(useSimulationStore.getState().workflow.map((d) => d.weather)).toEqual([
      'sunny',
      'cloudy',
    ]);
    expect(useSimulationStore.getState().status).toBe('modified');

    useSimulationStore.getState().run();
    const strip = screen.getByRole('navigation', { name: 'Simulated days' });
    fireEvent.click(within(strip).getByRole('button', { name: /Day 2: Cloudy/ }));
    const state = useSimulationStore.getState();
    expect(state.dayIndex).toBe(1);
    expect(state.results.proportional).toBe(state.workflowResults.proportional?.days[1]?.result);
  });
});
