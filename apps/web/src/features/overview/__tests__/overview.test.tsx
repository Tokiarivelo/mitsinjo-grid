import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import { OverviewPage } from '../index';

describe('OverviewPage (P4-T3, P4-T7)', () => {
  beforeEach(() => {
    resetSimulationStore();
  });

  it('renders simulated data notice and heading in initial empty state', () => {
    render(<OverviewPage />);
    expect(screen.getByText('SIMULATED DATA')).toBeInTheDocument();
    expect(screen.getByText('Mitsinjo Grid')).toBeInTheDocument();

    // 4 metric cards in empty state
    expect(screen.getByText('Peak Solar PV')).toBeInTheDocument();
    expect(screen.getByText('Battery End SoC')).toBeInTheDocument();
    expect(screen.getByText('Total 24h Demand')).toBeInTheDocument();
    expect(screen.getByText('Essential Services')).toBeInTheDocument();

    // CTA button to run simulation
    const runButtons = screen.getAllByRole('button', { name: /run simulation/i });
    expect(runButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('runs simulation on button click and populates cards, chart and energy bars', () => {
    render(<OverviewPage />);
    const runBtn = screen.getAllByRole('button', { name: /run simulation/i })[0]!;
    fireEvent.click(runBtn);

    // After running, simulation status is complete
    expect(useSimulationStore.getState().status).toBe('complete');

    // All 5 community sectors are rendered with progressbars
    expect(screen.getAllByText('Health Clinic').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Water Pumping Station').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Primary School').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Village Households').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Local Market & Artisans').length).toBeGreaterThanOrEqual(1);

    const progressbars = screen.getAllByRole('progressbar');
    expect(progressbars.length).toBe(5);

    // Energy balance items are displayed
    expect(screen.getByText(/Total Solar Generation/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Served Energy/i)).toBeInTheDocument();
  });

  it('displays warning and impact insight on cloudy_afternoon deficit', () => {
    useSimulationStore.getState().loadScenario('cloudy_afternoon');
    useSimulationStore.getState().run();

    render(<OverviewPage />);

    // Essential shortfall detected in cards and insight banner
    const shortfallElements = screen.getAllByText(/critical shortfall/i);
    expect(shortfallElements.length).toBeGreaterThanOrEqual(1);
  });
});
