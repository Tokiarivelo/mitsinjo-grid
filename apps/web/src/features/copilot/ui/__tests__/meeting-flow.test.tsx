import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import { CopilotWorkspace } from '../copilot-workspace';

const MEETING = {
  turns: [
    { speaker: 'A', text: 'Never cut the clinic.', startMs: 0, endMs: 1000 },
    { speaker: 'B', text: 'The school needs light in the morning.', startMs: 1000, endMs: 2000 },
  ],
  priorities: [
    { speaker: 'A', sector: 'health', want: 'protect', quote: 'Never cut the clinic.' },
    {
      speaker: 'B',
      sector: 'school',
      want: 'mention',
      quote: 'The school needs light in the morning.',
      timeNote: 'morning',
    },
  ],
  patch: {
    priorities: { health: 'critical', school: 'high' },
    lifeline: { kw: { health: 0.5 } },
  },
  unmapped: [],
  source: 'mock',
};

describe('meeting flow (M10-T4)', () => {
  beforeEach(() => {
    resetSimulationStore();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/api/meetings')) {
          return { ok: true, json: async () => MEETING };
        }
        return { ok: true, json: async () => ({ sessions: [], models: ['auto'] }) };
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('upload → diarized block in chat → propose → usual dialog → approve applies', async () => {
    render(<CopilotWorkspace mode="full" />);
    const file = new File([new Uint8Array(100)], 'meeting.wav', { type: 'audio/wav' });
    fireEvent.change(screen.getByLabelText(/transcribe a meeting/i), {
      target: { files: [file] },
    });

    // The meeting block lands in the chat with turns + priorities.
    const chat = screen.getByRole('log');
    expect(await within(chat).findByText(/Never cut the clinic\./)).toBeInTheDocument();
    expect(await within(chat).findByText(/Who wants what/)).toBeInTheDocument();

    // Propose → the usual confirmation dialog with the priorities lines.
    fireEvent.click(within(chat).getByRole('button', { name: /propose these priorities/i }));
    const approve = await within(chat).findByRole('button', { name: /Approve & Apply Scenario/i });
    expect(approve).toBeInTheDocument();

    fireEvent.click(approve);
    const sectorPriority = (id: string) =>
      useSimulationStore.getState().input.sectors.find((s) => s.id === id)?.priority;
    await waitFor(() => expect(sectorPriority('health')).toBe('critical'));
    expect(sectorPriority('school')).toBe('high');
  });
});
