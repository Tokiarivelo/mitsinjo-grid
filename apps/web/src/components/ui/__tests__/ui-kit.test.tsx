import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Button,
  StatusBadge,
  MetricCard,
  EnergyBar,
  SimControl,
  EmptyState,
  ChartCard,
  type StatusBadgeVariant,
} from '../index';

describe('UI Kit — P2-T6 Design Gate Tests', () => {
  describe('StatusBadge', () => {
    const variants: StatusBadgeVariant[] = [
      'ready',
      'running',
      'complete',
      'warning',
      'critical',
      'simulated',
      'ai',
    ];

    it('always renders a visible text label for all variants (never color-only)', () => {
      variants.forEach((variant) => {
        const { unmount } = render(<StatusBadge variant={variant} />);
        const badge = screen.getByText(
          variant === 'ready'
            ? 'READY'
            : variant === 'running'
            ? 'SIMULATING'
            : variant === 'complete'
            ? 'SIMULATION COMPLETE'
            : variant === 'warning'
            ? 'WARNING'
            : variant === 'critical'
            ? 'CRITICAL'
            : variant === 'simulated'
            ? 'SIMULATED DATA'
            : 'AI-GENERATED'
        );
        expect(badge).toBeInTheDocument();
        expect(badge.textContent).toBeTruthy();
        unmount();
      });
    });

    it('renders custom label when provided', () => {
      render(<StatusBadge variant="ai" label="AI EXPLANATION" />);
      expect(screen.getByText('AI EXPLANATION')).toBeInTheDocument();
    });
  });

  describe('MetricCard', () => {
    it('always displays the specified unit in nominal state', () => {
      render(
        <MetricCard
          variant="solar"
          label="Solar PV Peak"
          value={40}
          unit="kWp"
        />
      );
      expect(screen.getByText('Solar PV Peak')).toBeInTheDocument();
      expect(screen.getByText('40')).toBeInTheDocument();
      expect(screen.getByText('kWp')).toBeInTheDocument();
    });

    it('displays unit even in empty state', () => {
      render(
        <MetricCard
          variant="battery"
          label="Battery Capacity"
          value={0}
          unit="kWh"
          empty
        />
      );
      expect(screen.getByText('Battery Capacity')).toBeInTheDocument();
      expect(screen.getByText('--')).toBeInTheDocument();
      expect(screen.getByText('kWh')).toBeInTheDocument();
    });

    it('displays warning and critical status indicators with text labels', () => {
      const { unmount } = render(
        <MetricCard
          variant="battery"
          label="Battery Level"
          value={19}
          unit="%"
          status="critical"
        />
      );
      expect(screen.getByText('CRITICAL')).toBeInTheDocument();
      unmount();

      render(
        <MetricCard
          variant="battery"
          label="Battery Level"
          value={25}
          unit="%"
          status="warning"
        />
      );
      expect(screen.getByText('WARNING')).toBeInTheDocument();
    });
  });

  describe('Focus-visible styles & Accessibility', () => {
    it('Button includes energy-cyan focus-visible ring styles', () => {
      render(<Button variant="primary">Run simulation</Button>);
      const btn = screen.getByRole('button', { name: /run simulation/i });
      expect(btn.className).toContain('focus-visible:ring-energy-cyan');
    });

    it('SimControl slider includes accessible attributes and focus-visible styles', () => {
      render(
        <SimControl
          label="Solar Drop"
          value={40}
          unit="%"
          min={0}
          max={90}
          onChange={() => {}}
        />
      );
      const slider = screen.getByRole('slider', { name: /solar drop/i });
      expect(slider).toHaveAttribute('aria-valuemin', '0');
      expect(slider).toHaveAttribute('aria-valuemax', '90');
      expect(slider).toHaveAttribute('aria-valuenow', '40');
      expect(slider).toHaveAttribute('aria-valuetext', '40 %');
      expect(slider.className).toContain('focus-visible:ring-energy-cyan');
    });

    it('EnergyBar implements progressbar role with aria values', () => {
      render(
        <EnergyBar
          label="Health Clinic"
          valuePct={92.5}
          servedKwh={18.5}
          demandKwh={20.0}
          priority="critical"
        />
      );
      const bar = screen.getByRole('progressbar', { name: /health clinic energy coverage/i });
      expect(bar).toHaveAttribute('aria-valuenow', '92.5');
      expect(screen.getByText('92.5%')).toBeInTheDocument();
      expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    });

    it('EmptyState renders title, description, and action button', () => {
      render(
        <EmptyState
          title="No simulation run"
          description="Click run to generate results"
          actionLabel="Run now"
          onAction={() => {}}
        />
      );
      expect(screen.getByText('No simulation run')).toBeInTheDocument();
      expect(screen.getByText('Click run to generate results')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /run now/i })).toBeInTheDocument();
    });

    it('ChartCard renders accessible summary text for screen readers', () => {
      render(
        <ChartCard
          title="Hourly Generation"
          summary="Generation peaks at 38 kW at midday"
          unit="kW"
        >
          <div>Chart Graphic</div>
        </ChartCard>
      );
      expect(screen.getByText('Generation peaks at 38 kW at midday')).toHaveClass('sr-only');
    });
  });
});
