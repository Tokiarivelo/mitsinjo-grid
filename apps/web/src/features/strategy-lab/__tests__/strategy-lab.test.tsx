import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import { StrategyLabPage } from '../index';

describe('StrategyLabPage (P4-T5, P4-T7)', () => {
  beforeEach(() => {
    resetSimulationStore();
  });

  it('renders simulated badge and 3 strategy columns with empty initial states', () => {
    render(<StrategyLabPage />);

    expect(screen.getByText('SIMULATED DATA')).toBeInTheDocument();
    expect(screen.getByText('Proportional Allocation')).toBeInTheDocument();
    expect(screen.getByText('Essential-First Priority')).toBeInTheDocument();
    expect(screen.getByText('Balanced Distribution')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /compare strategies/i })).toBeInTheDocument();
  });

  it('compares strategies and displays metrics and decision summary on cloudy_afternoon', () => {
    useSimulationStore.getState().loadScenario('cloudy_afternoon');
    render(<StrategyLabPage />);

    const compareBtn = screen.getByRole('button', { name: /compare strategies/i });
    fireEvent.click(compareBtn);

    // Decision summary should recommend essential_first due to clinic protection
    expect(screen.getByText(/Critical Lifeline Protection Under Deficit/i)).toBeInTheDocument();

    // Check that each strategy column shows delivered and essential metrics
    const deliveredLabels = screen.getAllByText('Delivered Energy');
    expect(deliveredLabels.length).toBeGreaterThanOrEqual(3);
  });

  it('allows clicking "Use this strategy" to switch the active strategy', () => {
    useSimulationStore.getState().loadScenario('cloudy_afternoon');
    useSimulationStore.getState().run();

    render(<StrategyLabPage />);

    expect(useSimulationStore.getState().activeStrategy).toBe('proportional');

    // Click "Use this strategy" on Essential-First card
    const useButtons = screen.getAllByRole('button', { name: /use this strategy/i });
    expect(useButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(useButtons[0]!);

    expect(useSimulationStore.getState().activeStrategy).toBe('essential_first');
  });
});
