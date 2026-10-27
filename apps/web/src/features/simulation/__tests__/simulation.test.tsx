import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import { SimulationPage } from '../index';

describe('SimulationPage (P5-T1, P5-T2, P5-T5, P5-T6)', () => {
  beforeEach(() => {
    resetSimulationStore();
  });

  it(
    'renders initial simulation page with controls, viewport, and empty analytical state',
    () => {
      render(<SimulationPage />);

      // SIMULATED DATA badge & title
      expect(screen.getAllByText('SIMULATED DATA').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Live Simulation')).toBeInTheDocument();

      // Export buttons & Deck toggle
      expect(screen.getByRole('button', { name: /copy summary/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /download json/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /hide deck/i })).toBeInTheDocument();

      // Tab buttons in right deck
      expect(screen.getByRole('tab', { name: /metrics/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /controls/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /buildings/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /copilot/i })).toBeInTheDocument();

      // 4 Metric cards in active Metrics tab
      expect(screen.getByText('Peak Solar PV')).toBeInTheDocument();
      expect(screen.getByText('Battery End SoC')).toBeInTheDocument();
      expect(screen.getByText('Total 24h Demand')).toBeInTheDocument();
      expect(screen.getByText('Essential Services')).toBeInTheDocument();

      // Persistent Viewport & Timeline scrubber (docked outside tabs)
      expect(screen.getByText('24h Timeline Scrubber')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start timeline playback/i })).toBeInTheDocument();

      // Switch to Controls tab to inspect controls
      fireEvent.click(screen.getByRole('tab', { name: /controls/i }));
      expect(screen.getByText('Simulation Controls')).toBeInTheDocument();
      expect(screen.getByLabelText(/solar drop/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/demand multiplier/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/battery capacity/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/initial charge/i)).toBeInTheDocument();
    },
    10000
  );

  it('shows active sector caps with translated format (PY-T4)', () => {
    const input = structuredClone(useSimulationStore.getState().input);
    input.sectorCaps = [{ sector: 'market', maxKw: 1, fromHour: 18, toHour: 22 }];
    useSimulationStore.setState({ input });
    render(<SimulationPage />);

    fireEvent.click(screen.getByRole('tab', { name: /controls/i }));
    expect(screen.getByText('1 Active Caps')).toBeInTheDocument();
    expect(screen.getByText('1 kW (18:00–22:00)')).toBeInTheDocument();
  });

  it('sets status to modified when a control slider is changed', () => {
    render(<SimulationPage />);

    expect(useSimulationStore.getState().status).toBe('ready');

    fireEvent.click(screen.getByRole('tab', { name: /controls/i }));
    const demandSlider = screen.getByLabelText(/demand multiplier/i);
    fireEvent.change(demandSlider, { target: { value: '1.4' } });

    expect(useSimulationStore.getState().status).toBe('modified');
    expect(useSimulationStore.getState().input.demandMultiplier).toBe(1.4);
    expect(screen.getByText(/parameters modified/i)).toBeInTheDocument();
  });

  it('shows inline error message when parameter violates bounds', () => {
    render(<SimulationPage />);

    fireEvent.click(screen.getByRole('tab', { name: /controls/i }));

    // Try setting drop start hour to 23 when duration is 3 (23 + 3 = 26 > 24)
    const dropStartSlider = screen.getByLabelText(/drop start hour/i);
    fireEvent.change(dropStartSlider, { target: { value: '23' } });

    expect(screen.getByText(/drop start \+ duration cannot exceed 24 hours/i)).toBeInTheDocument();

    // Run button is disabled while validation errors exist
    const runBtn = screen.getByRole('button', { name: /run simulation/i });
    expect(runBtn).toBeDisabled();
  });

  it('runs simulation, transitions to complete, and populates metrics and step telemetry', () => {
    render(<SimulationPage />);

    // Switch to Controls tab to trigger run
    fireEvent.click(screen.getByRole('tab', { name: /controls/i }));
    const runBtn = screen.getByRole('button', { name: /run simulation/i });
    fireEvent.click(runBtn);

    expect(useSimulationStore.getState().status).toBe('complete');
    expect(useSimulationStore.getState().results.proportional).toBeDefined();

    // Switch back to Metrics tab to inspect sector energy bars
    fireEvent.click(screen.getByRole('tab', { name: /metrics/i }));
    const progressbars = screen.getAllByRole('progressbar');
    expect(progressbars.length).toBe(5);

    // Timeline step telemetry is displayed on persistent scrubber
    expect(screen.getByText('Total Load')).toBeInTheDocument();
    expect(screen.getByText('Power Served')).toBeInTheDocument();
    expect(screen.getByText('Battery Flux')).toBeInTheDocument();
  });

  it('scrubs through hours with timeline scrubber and updates current hour', () => {
    render(<SimulationPage />);

    const scrubber = screen.getByLabelText(/hour of day scrubber/i);
    fireEvent.change(scrubber, { target: { value: '15' } });

    expect(useSimulationStore.getState().timeIndex).toBe(15);
    expect(screen.getAllByText('15:00').length).toBeGreaterThanOrEqual(1);
  });

  it('selects a sector node and displays BuildingInspectorPanel with metrics', () => {
    // Run simulation first to have metrics
    useSimulationStore.getState().run();

    render(<SimulationPage />);

    // Switch to buildings tab
    fireEvent.click(screen.getByRole('tab', { name: /buildings/i }));

    // Click Health Clinic sector button in inspector
    const healthBtn = screen.getAllByRole('button', { name: /health clinic/i })[0]!;
    fireEvent.click(healthBtn);

    expect(useSimulationStore.getState().selectedSector).toBe('health');
    expect(screen.getByText('Critical Lifeline Share')).toBeInTheDocument();
    expect(screen.getByText('24h Demand')).toBeInTheDocument();
    expect(screen.getByText('24h Served')).toBeInTheDocument();
    expect(screen.getByText('24h Coverage')).toBeInTheDocument();
  });

  it('resets scenario to defaults on reset button click', () => {
    render(<SimulationPage />);

    fireEvent.click(screen.getByRole('tab', { name: /controls/i }));
    const demandSlider = screen.getByLabelText(/demand multiplier/i);
    fireEvent.change(demandSlider, { target: { value: '1.6' } });
    expect(useSimulationStore.getState().status).toBe('modified');

    const resetBtn = screen.getByRole('button', { name: /reset scenario/i });
    fireEvent.click(resetBtn);

    expect(useSimulationStore.getState().status).toBe('ready');
    expect(useSimulationStore.getState().input.demandMultiplier).toBe(1.0);
  });

  it('toggles right-side deck open and closed while keeping 24h scrubber accessible', () => {
    render(<SimulationPage />);

    // Deck starts open
    expect(screen.getByRole('tablist', { name: /telemetry & controls/i })).toBeInTheDocument();

    // Click toggle button to collapse deck
    const hideBtn = screen.getByRole('button', { name: /hide deck/i });
    fireEvent.click(hideBtn);

    // Deck tablist is hidden from accessible tree
    expect(screen.queryByRole('tablist', { name: /telemetry & controls/i })).not.toBeInTheDocument();

    // 24h Timeline Scrubber is still present and interactive
    expect(screen.getByText('24h Timeline Scrubber')).toBeInTheDocument();
    const scrubber = screen.getByLabelText(/hour of day scrubber/i);
    fireEvent.change(scrubber, { target: { value: '18' } });
    expect(useSimulationStore.getState().timeIndex).toBe(18);

    // Click Show Deck button to reopen
    const showBtn = screen.getByRole('button', { name: /show deck/i });
    fireEvent.click(showBtn);

    // Deck tablist is restored
    expect(screen.getByRole('tablist', { name: /telemetry & controls/i })).toBeInTheDocument();
  });
});
