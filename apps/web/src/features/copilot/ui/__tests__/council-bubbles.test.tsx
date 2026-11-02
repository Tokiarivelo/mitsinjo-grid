import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CouncilBubbles } from '../council-bubbles';
import type { CopilotCouncil } from '../../types';

const COUNCIL: CopilotCouncil = {
  question: 'Who should shed load tonight?',
  rounds: 1,
  agents: [
    {
      sector: 'health',
      reason: 'Survival current for the vaccine cold chain.',
      patch: { lifeline: { kw: { health: 1 } } },
      impact: {
        beforeResultId: 'SIM-A',
        afterResultId: 'SIM-B',
        strategyBefore: 'proportional',
        strategyAfter: 'proportional',
        socMinPctBefore: 20,
        socMinPctAfter: 20,
        unservedKwhBefore: 2,
        unservedKwhAfter: 0.4,
        sectors: {
          health: {
            servedKwhBefore: 10,
            servedKwhAfter: 11.2,
            servedKwhDelta: 1.2,
            offHoursBefore: 2,
            offHoursAfter: 0,
          },
        },
      },
      mock: true,
    },
    {
      sector: 'market',
      reason: 'Stalls keep cold storage alive.',
      patch: { lifeline: { kw: { market: 0.4 } } },
      impact: {
        beforeResultId: 'SIM-A',
        afterResultId: 'SIM-C',
        strategyBefore: 'proportional',
        strategyAfter: 'proportional',
        socMinPctBefore: 20,
        socMinPctAfter: 20,
        unservedKwhBefore: 2,
        unservedKwhAfter: 1.8,
        sectors: {
          market: {
            servedKwhBefore: 8,
            servedKwhAfter: 8.1,
            servedKwhDelta: 0.1,
            offHoursBefore: 2,
            offHoursAfter: 2,
          },
        },
      },
      mock: true,
    },
  ],
  verdict: { pick: 'health', synthesis: 'The engine favors health.', mock: true },
};

describe('CouncilBubbles (M7-T1)', () => {
  it('shows one bubble per voice with engine-number badges', () => {
    render(<CouncilBubbles council={COUNCIL} />);
    expect(screen.getByText('Sector council')).toBeInTheDocument();
    expect(screen.getByText('Health Clinic')).toBeInTheDocument();
    expect(screen.getByText('Local Market & Artisans')).toBeInTheDocument();
    // Engine badges: own served delta + unserved after, exact engine values.
    expect(screen.getByText(/served \+1\.2 kWh/)).toBeInTheDocument();
    expect(screen.getByText(/unserved 0\.4 kWh/)).toBeInTheDocument();
    expect(screen.getByText(/served \+0\.1 kWh/)).toBeInTheDocument();
  });

  it('highlights the picked voice and shows the mediator verdict', () => {
    render(<CouncilBubbles council={COUNCIL} />);
    expect(screen.getByText('Mediator')).toBeInTheDocument();
    expect(screen.getByText('The engine favors health.')).toBeInTheDocument();
    expect(screen.getByText('Recommended')).toBeInTheDocument();
  });
});
