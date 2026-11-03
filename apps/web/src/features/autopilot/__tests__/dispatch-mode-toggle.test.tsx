import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DispatchModeToggle } from '../ui/dispatch-mode-toggle';
import { useSimulationStore } from '@/stores';

describe('DispatchModeToggle (PA-T4a)', () => {
  beforeEach(() => {
    useSimulationStore.setState({ dispatchMode: 'manual' });
  });

  it('renders 3 modes in header variant and switches to assisted and autonomous', () => {
    render(<DispatchModeToggle variant="header" />);
    const manualRadio = screen.getByRole('radio', { name: /manual/i });
    const assistedRadio = screen.getByRole('radio', { name: /assisted/i });
    const autoRadio = screen.getByRole('radio', { name: /autonomous ai/i });

    expect(manualRadio).toHaveAttribute('aria-checked', 'true');
    expect(assistedRadio).toHaveAttribute('aria-checked', 'false');
    expect(autoRadio).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(assistedRadio);
    expect(useSimulationStore.getState().dispatchMode).toBe('assisted');

    fireEvent.click(autoRadio);
    expect(useSimulationStore.getState().dispatchMode).toBe('autonomous');
  });

  it('in autonomous mode, header variant shows permanent badge and >= 44px takeBackControl button', () => {
    useSimulationStore.setState({ dispatchMode: 'autonomous' });
    render(<DispatchModeToggle variant="header" />);

    // Permanent "AI IN CONTROL" badge
    expect(screen.getByText(/AI IN CONTROL/i)).toBeInTheDocument();

    // "Take back control" button
    const takeBackBtn = screen.getByRole('button', { name: /take back control/i });
    expect(takeBackBtn).toBeInTheDocument();
    expect(takeBackBtn.className).toMatch(/min-h-\[44px\]/);

    // Clicking takeBackControl restores manual mode
    fireEvent.click(takeBackBtn);
    expect(useSimulationStore.getState().dispatchMode).toBe('manual');
  });

  it('card variant renders 1-click launch button in manual mode and starts autonomous playback', () => {
    useSimulationStore.setState({ dispatchMode: 'manual', isPlaying: false });
    render(<DispatchModeToggle variant="card" />);

    const launchBtn = screen.getByRole('button', { name: /launch ai simulation/i });
    expect(launchBtn).toBeInTheDocument();

    fireEvent.click(launchBtn);
    expect(useSimulationStore.getState().dispatchMode).toBe('autonomous');
    expect(useSimulationStore.getState().isPlaying).toBe(true);
  });

  it('card variant in autonomous mode shows status, view log action, and takeBackControl', () => {
    useSimulationStore.setState({ dispatchMode: 'autonomous', isPlaying: true });
    const onOpenLog = vi.fn();
    render(<DispatchModeToggle variant="card" onOpenLog={onOpenLog} />);

    expect(screen.getByText(/AI IN CONTROL/i)).toBeInTheDocument();
    const logBtn = screen.getByRole('button', { name: /follow decisions live in event log/i });
    fireEvent.click(logBtn);
    expect(onOpenLog).toHaveBeenCalled();

    const takeBackBtn = screen.getByRole('button', { name: /take back control/i });
    fireEvent.click(takeBackBtn);
    expect(useSimulationStore.getState().dispatchMode).toBe('manual');
  });

  it('sidebar variant renders segmented control and responds to takeBackControl', () => {
    useSimulationStore.setState({ dispatchMode: 'autonomous' });
    render(<DispatchModeToggle variant="sidebar" />);

    expect(screen.getByText(/AI IN CONTROL/i)).toBeInTheDocument();
    const takeBackBtn = screen.getByRole('button', { name: /take back control/i });
    expect(takeBackBtn.className).toMatch(/min-h-\[44px\]/);

    fireEvent.click(takeBackBtn);
    expect(useSimulationStore.getState().dispatchMode).toBe('manual');
  });

  it('mobile variant shows docked banner and >=44px button when in autonomous mode', () => {
    useSimulationStore.setState({ dispatchMode: 'autonomous' });
    render(<DispatchModeToggle variant="mobile" />);

    expect(screen.getByText(/AI IN CONTROL/i)).toBeInTheDocument();
    const takeBackBtn = screen.getByRole('button', { name: /take back control/i });
    expect(takeBackBtn.className).toMatch(/min-h-\[44px\]/);

    fireEvent.click(takeBackBtn);
    expect(useSimulationStore.getState().dispatchMode).toBe('manual');
  });
});
