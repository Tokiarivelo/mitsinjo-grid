import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import { ScenariosPage } from '../index';

// Mock next/navigation useRouter
const pushMock = vi.fn();
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    useRouter: () => ({
      push: pushMock,
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    }),
    usePathname: () => '/scenarios',
  };
});

describe('ScenariosPage (P5-T3, P5-T6)', () => {
  beforeEach(() => {
    resetSimulationStore();
    pushMock.mockClear();
  });

  it('renders synthetic simulation provenance notice and all 5 scenario cards', () => {
    render(<ScenariosPage />);

    // Provenance notice
    expect(screen.getAllByText('SIMULATED DATA').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/all scenarios use synthetic mathematical models calibrated for solar microgrids/i)
    ).toBeInTheDocument();

    // 5 Predefined scenario cards
    expect(screen.getAllByText('Baseline 24h Nominal').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Cloudy Afternoon (-40%)')).toBeInTheDocument();
    expect(screen.getByText('High Evening Demand (+30%)')).toBeInTheDocument();
    expect(screen.getByText('Constrained Battery (60 kWh)')).toBeInTheDocument();
    expect(screen.getByText('Essential Stress (-60%)')).toBeInTheDocument();

    // Assumptions Inspector is visible
    expect(screen.getByText('Assumptions Inspector')).toBeInTheDocument();
    expect(screen.getByText('Fixed Engine Invariants')).toBeInTheDocument();
    expect(screen.getByText('24 h (1 h step)')).toBeInTheDocument();
  });

  it('clicking a scenario card inspects its assumptions and updates active store scenario', () => {
    render(<ScenariosPage />);

    const cloudyCard = screen.getByText('Cloudy Afternoon (-40%)');
    fireEvent.click(cloudyCard);

    expect(useSimulationStore.getState().scenarioId).toBe('cloudy_afternoon');
  });

  it('navigates to /simulation when clicking Open in Simulation', () => {
    render(<ScenariosPage />);

    const openButtons = screen.getAllByRole('button', { name: /open scenario/i });
    expect(openButtons.length).toBe(5);

    fireEvent.click(openButtons[1]!); // Cloudy afternoon card
    expect(useSimulationStore.getState().scenarioId).toBe('cloudy_afternoon');
    expect(pushMock).toHaveBeenCalledWith('/simulation');
  });

  it('editing an assumption in AssumptionsInspector updates the store input and sets modified', () => {
    render(<ScenariosPage />);

    const batterySlider = screen.getByLabelText(/battery capacity/i);
    fireEvent.change(batterySlider, { target: { value: '150' } });

    expect(useSimulationStore.getState().status).toBe('modified');
    expect(useSimulationStore.getState().input.battery.capacityKwh).toBe(150);
  });

  it('resets assumptions to defaults when confirmed', () => {
    render(<ScenariosPage />);

    const batterySlider = screen.getByLabelText(/battery capacity/i);
    fireEvent.change(batterySlider, { target: { value: '180' } });
    expect(useSimulationStore.getState().status).toBe('modified');

    const resetBtn = screen.getByRole('button', { name: /reset to defaults/i });
    fireEvent.click(resetBtn);

    // Prompt changes to confirmation
    const confirmBtn = screen.getByRole('button', { name: /confirm reset/i });
    fireEvent.click(confirmBtn);

    expect(useSimulationStore.getState().status).toBe('ready');
    expect(useSimulationStore.getState().input.battery.capacityKwh).toBe(120);
  });

  it('shows latest run reproducibility summary with result ID when simulation was executed', () => {
    useSimulationStore.getState().run();

    render(<ScenariosPage />);

    const resultId = useSimulationStore.getState().results.proportional?.id;
    expect(resultId).toBeDefined();

    expect(screen.getByText(resultId!)).toBeInTheDocument();
    expect(screen.getByText(/Served:/i)).toBeInTheDocument();
    expect(screen.getByText(/Essential Coverage:/i)).toBeInTheDocument();
  });
});
