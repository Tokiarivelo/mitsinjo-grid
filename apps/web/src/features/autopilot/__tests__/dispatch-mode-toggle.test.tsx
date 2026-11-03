import { describe, it, expect, beforeEach } from 'vitest';
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
