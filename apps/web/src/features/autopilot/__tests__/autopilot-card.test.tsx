import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AutopilotCard } from '../autopilot-card';
import { ENVELOPE_OFF } from '@/lib/envelope';
import type { AutopilotEntry } from '../use-autopilot';

const ENTRY: AutopilotEntry = {
  id: 'h18-1',
  hour: 18,
  suggestion: { hour: 18, rule: 'strategy', strategy: 'essential_first', shortKwh: 0.276 },
  decision: 'pending',
  auto: false,
};

const BASE = {
  enabled: false,
  setEnabled: () => {},
  envelope: ENVELOPE_OFF,
  setEnvelope: () => {},
  pending: null,
  history: [],
  accept: () => {},
  refuse: () => {},
};

describe('AutopilotCard (M10-T1)', () => {
  it('toggle is off by default; pending suggestion has one-tap accept/refuse', () => {
    const setEnabled = vi.fn();
    const accept = vi.fn();
    const refuse = vi.fn();
    render(
      <AutopilotCard
        enabled={false}
        setEnabled={setEnabled}
        envelope={ENVELOPE_OFF}
        setEnvelope={vi.fn()}
        pending={ENTRY}
        history={[ENTRY]}
        accept={accept}
        refuse={refuse}
      />
    );
    expect(screen.getByRole('switch', { name: /autopilot/i })).toHaveAttribute(
      'aria-checked',
      'false'
    );
    // Pending suggestion + its history row both show the hour.
    expect(screen.getAllByText(/18:00/)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /^accept$/i }));
    expect(accept).toHaveBeenCalledWith('h18-1');
    fireEvent.click(screen.getByRole('button', { name: /^refuse$/i }));
    expect(refuse).toHaveBeenCalledWith('h18-1');
  });

  it('history shows past decisions', () => {
    render(
      <AutopilotCard
        enabled={true}
        setEnabled={vi.fn()}
        envelope={ENVELOPE_OFF}
        setEnvelope={vi.fn()}
        pending={null}
        history={[
          { ...ENTRY, decision: 'accepted' },
          { ...ENTRY, id: 'h19-1', hour: 19, decision: 'refused' },
        ]}
        accept={vi.fn()}
        refuse={vi.fn()}
      />
    );
    expect(screen.getByText(/accepted/i)).toBeInTheDocument();
    expect(screen.getByText(/refused/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^accept$/i })).toBeNull();
  });

  it('envelope switches are off by default and toggle one permission (M10-T3)', () => {
    const setEnvelope = vi.fn();
    render(<AutopilotCard {...BASE} setEnvelope={setEnvelope} />);
    const strategy = screen.getByRole('switch', { name: /strategy switches apply alone/i });
    const floor = screen.getByRole('switch', { name: /clinic floor applies alone/i });
    expect(strategy).toHaveAttribute('aria-checked', 'false');
    expect(floor).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(strategy);
    expect(setEnvelope).toHaveBeenCalledWith({ strategyChange: true, clinicFloor: false });
  });

  it('auto-applied history rows carry the auto badge (M10-T3)', () => {
    render(
      <AutopilotCard
        {...BASE}
        enabled={true}
        history={[{ ...ENTRY, decision: 'accepted', auto: true }]}
      />
    );
    expect(screen.getByText(/accepted · auto/i)).toBeInTheDocument();
  });
});
