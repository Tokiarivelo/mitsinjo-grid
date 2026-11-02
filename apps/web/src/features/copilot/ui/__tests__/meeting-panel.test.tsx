import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CopilotProvider } from '../../hooks/copilot-context';
import { MeetingPanel } from '../meeting-panel';

const MEETING = {
  turns: [{ speaker: 'A', text: 'Never cut the clinic.', startMs: 0, endMs: 1000 }],
  priorities: [{ speaker: 'A', sector: 'health', want: 'protect', quote: 'Never cut the clinic.' }],
  patch: { priorities: { health: 'critical' }, lifeline: { kw: { health: 0.5 } } },
  unmapped: [],
  source: 'mock',
};

function stubFetch(meetingsOk: boolean) {
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes('/api/meetings')) {
      return meetingsOk ? { ok: true, json: async () => MEETING } : { ok: false, status: 500 };
    }
    return { ok: true, json: async () => ({ sessions: [], models: ['auto'] }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('MeetingPanel (M10-T4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uploads a WAV, posts the meeting to the chat, shows the status', async () => {
    const fetchMock = stubFetch(true);
    render(
      <CopilotProvider>
        <MeetingPanel />
      </CopilotProvider>
    );
    const file = new File([new Uint8Array(100)], 'meeting.wav', { type: 'audio/wav' });
    fireEvent.change(screen.getByLabelText(/transcribe a meeting/i), {
      target: { files: [file] },
    });
    expect(await screen.findByText(/1 turns, 1 priorities/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/meetings'))).toBe(true);
  });

  it('shows an error when transcription fails', async () => {
    stubFetch(false);
    render(
      <CopilotProvider>
        <MeetingPanel />
      </CopilotProvider>
    );
    const file = new File([new Uint8Array(100)], 'meeting.wav', { type: 'audio/wav' });
    fireEvent.change(screen.getByLabelText(/transcribe a meeting/i), {
      target: { files: [file] },
    });
    expect(await screen.findByText(/transcription failed/i)).toBeInTheDocument();
  });

  it('does not render outside the full workspace (mount check)', async () => {
    stubFetch(true);
    const { CopilotWorkspace } = await import('../copilot-workspace');
    const { container } = render(<CopilotWorkspace mode="panel" />);
    expect(container.textContent).not.toMatch(/Transcribe a meeting/);
  }, 15000);
});
