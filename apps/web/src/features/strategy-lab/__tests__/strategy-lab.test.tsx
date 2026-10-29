import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTO_COMPARE_DELAY_MS } from '../hooks/use-auto-compare';
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

  describe('comparison parameters panel (PZ-T1..T4)', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('re-runs all strategies automatically after a condition slider moves', () => {
      render(<StrategyLabPage />);
      const slider = screen.getByLabelText('Solar Drop');
      fireEvent.change(slider, { target: { value: '60' } });
      expect(useSimulationStore.getState().status).toBe('modified');

      act(() => vi.advanceTimersByTime(AUTO_COMPARE_DELAY_MS));
      const state = useSimulationStore.getState();
      expect(state.status).toBe('complete');
      expect(state.input.events.find((e) => e.type === 'solar_drop')?.factor).toBeCloseTo(0.4);
    });

    it('a household priority change moves Essential-First results and leaves Proportional unchanged', () => {
      useSimulationStore.getState().loadScenario('essential_stress');
      useSimulationStore.getState().run();
      const before = useSimulationStore.getState().results;
      render(<StrategyLabPage />);

      fireEvent.change(screen.getByLabelText('Priority for Village Households'), {
        target: { value: 'critical' },
      });
      act(() => vi.advanceTimersByTime(AUTO_COMPARE_DELAY_MS));

      const after = useSimulationStore.getState().results;
      expect(
        useSimulationStore.getState().input.sectors.find((s) => s.id === 'households')?.priority
      ).toBe('critical');
      expect(after.proportional!.metrics.perSector.households!.servedKwh).toBeCloseTo(
        before.proportional!.metrics.perSector.households!.servedKwh
      );
      expect(after.essential_first!.metrics.perSector.households!.servedKwh).toBeGreaterThan(
        before.essential_first!.metrics.perSector.households!.servedKwh + 0.1
      );
    });

    it('adds a valid sector cap, rejects an inverted window, and resets to the scenario', () => {
      render(<StrategyLabPage />);
      const market = document.querySelector('[data-sector="market"]') as HTMLElement;
      fireEvent.click(
        within(market).getByRole('button', { name: 'Limit power for Local Market & Artisans' })
      );
      expect(useSimulationStore.getState().input.sectorCaps).toEqual([
        { sector: 'market', maxKw: 1, fromHour: 18, toHour: 22 },
      ]);

      fireEvent.change(within(market).getByLabelText('From (h)'), { target: { value: '23' } });
      expect(within(market).getByRole('alert')).toHaveTextContent(/after start hour/i);
      expect(useSimulationStore.getState().input.sectorCaps?.[0]?.fromHour).toBe(18);

      fireEvent.click(screen.getByRole('button', { name: /reset to scenario/i }));
      const state = useSimulationStore.getState();
      expect(state.input.sectorCaps ?? []).toEqual([]);
      expect(state.status).toBe('complete');
    });

    it('shows no best-value badge when every strategy ties (baseline)', () => {
      useSimulationStore.getState().run();
      render(<StrategyLabPage />);
      expect(screen.queryByText('TOP')).not.toBeInTheDocument();
      expect(screen.queryByText('BEST')).not.toBeInTheDocument();
      expect(screen.queryByText('MIN')).not.toBeInTheDocument();
      expect(screen.queryByText('MAX')).not.toBeInTheDocument();
    });

    it('collapses and expands the panel', () => {
      render(<StrategyLabPage />);
      const toggle = screen.getByRole('button', { name: /comparison parameters/i });
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByLabelText('Solar Drop')).not.toBeInTheDocument();
    });
  });
});
