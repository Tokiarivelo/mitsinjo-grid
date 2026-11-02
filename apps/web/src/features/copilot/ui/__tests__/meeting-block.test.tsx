import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MeetingBlock } from '../meeting-block';
import type { CopilotMeeting } from '../../types';

const MEETING: CopilotMeeting = {
  turns: [
    { speaker: 'A', text: 'Never cut the clinic.', startMs: 0, endMs: 1000 },
    { speaker: 'B', text: 'We need more light everywhere.', startMs: 1000, endMs: 2000 },
  ],
  priorities: [{ speaker: 'A', sector: 'health', want: 'protect', quote: 'Never cut the clinic.' }],
  patch: {
    priorities: { health: 'critical' },
    lifeline: { kw: { health: 0.5 } },
  },
  unmapped: [{ quote: 'We need more light everywhere.', reason: 'no_sector' }],
  source: 'mock',
};

describe('MeetingBlock (M10-T4)', () => {
  it('shows turns, who-wants-what, unmapped notes, and proposes the patch', () => {
    const onPropose = vi.fn();
    render(<MeetingBlock meeting={MEETING} onPropose={onPropose} />);
    expect(screen.getByText('Village meeting')).toBeInTheDocument();
    expect(screen.getByText(/Never cut the clinic\./)).toBeInTheDocument();
    expect(screen.getByText(/Speaker A/)).toBeInTheDocument();
    expect(screen.getByText(/Health Clinic/)).toBeInTheDocument();
    expect(screen.getByText(/protect first/)).toBeInTheDocument();
    expect(screen.getByText(/Not mapped to a sector/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /propose these priorities/i }));
    expect(onPropose).toHaveBeenCalledWith(MEETING.patch, expect.stringContaining('1 priorities'));
  });

  it('no sector want → no propose button', () => {
    render(
      <MeetingBlock
        meeting={{ ...MEETING, priorities: [], patch: {}, unmapped: MEETING.unmapped }}
        onPropose={vi.fn()}
      />
    );
    expect(screen.getByText(/nothing to propose/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /propose/i })).toBeNull();
  });
});
