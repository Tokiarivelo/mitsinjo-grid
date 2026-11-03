import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../utils/wav', () => ({
  toVoiceWav: vi.fn(async () => new Blob([new Uint8Array(100)], { type: 'audio/wav' })),
}));
import { resetSimulationStore, useSimulationStore } from '@/stores';
import { CopilotWorkspace } from '../ui/copilot-workspace';
import { ConfirmProposalDialog } from '../ui/confirm-proposal-dialog';
import type { CopilotProposal } from '../types';
import type { SectorCap } from '@mitsinjo/engine';
import { proposalImpact } from '@/lib/proposal-impact';

/** Fake `/api/copilot` stream: the given SSE events, then done. */
function sse(events: [string, Record<string, unknown>][]) {
  const body = [...events, ['done', {}] as [string, Record<string, unknown>]]
    .map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)
    .join('');
  // Minimal response: the hook only reads `ok` and `body.getReader()`.
  let sent = false;
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () => {
          if (sent) return { done: true, value: undefined };
          sent = true;
          return { done: false, value: new TextEncoder().encode(body) };
        },
      }),
    },
  } as unknown as Response;
}

const json = (data: unknown) => ({ ok: true, json: async () => data }) as unknown as Response;

function mockApi(chatEvents: [string, Record<string, unknown>][]) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/copilot' && init?.method === 'POST') return sse(chatEvents);
    if (url === '/api/copilot/models') return json({ models: ['auto'] });
    if (url === '/api/copilot/sessions') return json({ sessions: [] });
    return json({ success: true });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function ask(prompt: string) {
  const box = screen.getByRole('textbox');
  fireEvent.change(box, { target: { value: prompt } });
  fireEvent.keyDown(box, { key: 'Enter' });
}

/** Minimal MediaRecorder fake (mirrors the one in use-voice-input.test.ts). */
class FakeVoiceRecorder {
  static isTypeSupported = () => true;
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(readonly stream: MediaStream) {}
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([new Uint8Array(10)]) });
    this.onstop?.();
  }
}
const voiceStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;

/** Scripted microphone energy for hands-free tests: one RMS value per 100 ms sample. */
function stubVoiceAudio(frames: number[]) {
  let i = 0;
  const node = {
    fftSize: 1024,
    frequencyBinCount: 512,
    context: { sampleRate: 48000 },
    getByteTimeDomainData(arr: Uint8Array) {
      const amp = frames[Math.min(i++, frames.length - 1)]! * 128;
      for (let k = 0; k < arr.length; k++) arr[k] = 128 + (k % 2 === 0 ? amp : -amp);
    },
    getByteFrequencyData(arr: Uint8Array) {
      arr.fill(0);
    },
  };
  class FakeAudioContext {
    createAnalyser = () => node;
    createMediaStreamSource = () => ({ connect: vi.fn() });
    close = vi.fn(async () => {});
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
}

const marketCut: CopilotProposal & { patch: { sectorCaps: SectorCap[] } } = {
  proposalId: 'PROP-MKT',
  patch: { sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 18, toHour: 22 }] },
  reason: 'Cut the market tonight',
};

describe('Copilot chat flow (decisions, fallback note)', () => {
  beforeEach(() => resetSimulationStore());
  afterEach(() => vi.unstubAllGlobals());

  it('approving applies that proposal once, locks the card and posts the decision', async () => {
    const fetchMock = mockApi([
      ['delta', { text: 'I propose a change.' }],
      ['proposal', { ...marketCut }],
    ]);
    render(<CopilotWorkspace mode="panel" />);
    await ask('Cut the market tonight');

    fireEvent.click(await screen.findByRole('button', { name: /Approve & Apply Scenario/i }));

    const decision = await screen.findByRole('status', { name: '' });
    expect(decision).toHaveTextContent('Change approved and applied to the simulation');
    expect(decision).toHaveTextContent('Local Market & Artisans Capacity Cap');
    expect(decision).toHaveTextContent('0 kW (18:00–22:00)');
    expect(useSimulationStore.getState().input.sectorCaps).toEqual(marketCut.patch.sectorCaps);

    // Buttons gone: the card cannot be approved twice.
    expect(screen.queryByRole('button', { name: /Approve & Apply Scenario/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Reject$/i })).toBeNull();
    expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
    // Locked card + decision message keep the values as decided ("None → 0 kW"), not "0 kW → 0 kW".
    expect(screen.getAllByText('None (uncapped)')).toHaveLength(2);

    // Saved with the session.
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).startsWith('/api/copilot/sessions/') &&
            String(init?.body).includes('"role":"decision"')
        )
      ).toBe(true)
    );
  });

  it('"Undo last change" restores the input and marks the change undone (M1-T4)', async () => {
    const fetchMock = mockApi([['proposal', { ...marketCut }]]);
    render(<CopilotWorkspace mode="panel" />);
    await ask('Cut the market tonight');
    fireEvent.click(await screen.findByRole('button', { name: /Approve & Apply Scenario/i }));
    expect(useSimulationStore.getState().input.sectorCaps).toEqual(marketCut.patch.sectorCaps);

    fireEvent.click(await screen.findByRole('button', { name: 'Undo last change' }));

    expect(await screen.findByText('Change undone')).toBeInTheDocument();
    expect(useSimulationStore.getState().input.sectorCaps ?? []).toEqual([]);
    expect(useSimulationStore.getState().changeHistory).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Undo last change' })).toBeNull();
    expect(screen.getAllByText('Undone').length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([, init]) => String(init?.body).includes('"status":"undone"'))
      ).toBe(true)
    );
  });

  it('partial approval applies only the checked lines (M1-T5, K3)', async () => {
    const caps: SectorCap[] = [
      { sector: 'market', maxKw: 0, fromHour: 8, toHour: 18 },
      { sector: 'school', maxKw: 0, fromHour: 8, toHour: 18 },
    ];
    const { input, activeStrategy } = useSimulationStore.getState();
    const { impact } = proposalImpact(input, activeStrategy, { sectorCaps: caps });
    const fetchMock = mockApi([
      ['proposal', { proposalId: 'PROP-TWO', patch: { sectorCaps: caps }, reason: 'r', impact }],
    ]);
    render(<CopilotWorkspace mode="panel" />);
    await ask('Cut the market and the school');

    // Both lines checked: the server's impact lists both sectors.
    expect(await screen.findByText('Primary School: served energy')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Apply: Primary School Capacity Cap' }));

    // Impact follows the checked lines only.
    expect(screen.queryByText('Primary School: served energy')).toBeNull();
    expect(screen.getByText('Local Market & Artisans: served energy')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Approve selected (1)' }));

    expect(useSimulationStore.getState().input.sectorCaps).toEqual([caps[0]]);
    expect((await screen.findAllByText('Not applied (unchecked)')).length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([, init]) => String(init?.body).includes('"skipped"'))
      ).toBe(true)
    );
  });

  it('unchecking the clinic cut drops the second confirmation (K3 + K6)', async () => {
    mockApi([
      [
        'proposal',
        {
          proposalId: 'PROP-CLN',
          patch: {
            sectorCaps: [
              { sector: 'market', maxKw: 0, fromHour: 18, toHour: 22 },
              { sector: 'health', maxKw: 0, fromHour: 18, toHour: 22 },
            ],
          },
          reason: 'r',
        },
      ],
    ]);
    render(<CopilotWorkspace mode="panel" />);
    await ask('Cut the market and the clinic');
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Apply: Health Clinic Capacity Cap' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Approve selected (1)' }));
    expect(useSimulationStore.getState().input.sectorCaps?.map((c) => c.sector)).toEqual([
      'market',
    ]);
  });

  it('a fire burning now turns the suggestions into questions about it (M2)', async () => {
    const fetchMock = mockApi([['delta', { text: 'Fire answer.' }]]);
    useSimulationStore.setState({ timeIndex: 12 });
    useSimulationStore.getState().reportFire('water');
    render(<CopilotWorkspace mode="panel" />);

    const group = screen.getByRole('group', { name: 'About the fire' });
    const first = within(group).getByRole('button', {
      name: /Fire at Water Pumping Station: what does it change for the village right now\?/,
    });
    expect(
      within(group).getAllByRole('button', { name: /^Fire at Water Pumping Station/ })
    ).toHaveLength(4);

    fireEvent.click(first);
    expect(await screen.findByText('Fire answer.')).toBeInTheDocument();
    const body = String(
      fetchMock.mock.calls.find(([url]) => url === '/api/copilot')?.[1]?.body ?? ''
    );
    expect(body).toContain('Fire at Water Pumping Station');
    // The engine input sent along carries the fire, so the copilot reasons on it.
    expect(body).toContain('"type":"fire"');
  });

  it('sends the day and the dispatch log so get_dispatch_log can answer "Why?" (PA-T5b)', async () => {
    const fetchMock = mockApi([['delta', { text: 'Log answer.' }]]);
    const entry = {
      id: 'act-d0-h14',
      day: 0,
      hour: 14,
      mode: 'autonomous' as const,
      origin: 'ai' as const,
      action: { kind: 'alert_only' as const },
      hash: 'h1',
    };
    useSimulationStore.setState({ dispatchLog: [entry] });
    render(<CopilotWorkspace mode="panel" />);
    await ask('Why did the AI act?');
    await screen.findByText('Log answer.');

    const call = fetchMock.mock.calls.find(([url]) => url === '/api/copilot');
    const body = JSON.parse(String(call?.[1]?.body)) as {
      day?: number;
      dispatchLog?: { id: string }[];
    };
    expect(body.day).toBe(0);
    expect(body.dispatchLog?.map((e) => e.id)).toEqual(['act-d0-h14']);
  });

  it('Retry asks the same question again without the unsatisfying answer', async () => {
    const fetchMock = mockApi([['delta', { text: 'First answer.' }]]);
    render(<CopilotWorkspace mode="panel" />);
    await ask('coupe Le courant du foyer du vilage');
    await screen.findByText('First answer.');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Answer redone below (Retry).')).toBeInTheDocument();
    const chatCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/copilot');
    expect(chatCalls).toHaveLength(2);
    const body = JSON.parse(String(chatCalls[1]![1]?.body)) as {
      retry?: boolean;
      messages: { role: string; content: string }[];
    };
    expect(body.retry).toBe(true);
    // Question sent once, old answer left out.
    expect(body.messages).toEqual([
      { role: 'user', content: 'coupe Le courant du foyer du vilage' },
    ]);
    expect(screen.getAllByText('coupe Le courant du foyer du vilage')).toHaveLength(1);
    // Only the newest answer offers Retry.
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1));
  });

  it('a playback order from the chat moves the time cursor and says so', async () => {
    mockApi([
      ['control', { action: 'seek', hour: 18 }],
      ['delta', { text: 'Time cursor moved to 18:00.' }],
    ]);
    render(<CopilotWorkspace mode="panel" />);
    await ask('go to 18:00');
    expect(await screen.findByText('Time cursor moved to 18:00')).toBeInTheDocument();
    expect(useSimulationStore.getState().timeIndex).toBe(18);
    expect(useSimulationStore.getState().isPlaying).toBe(false);
  });

  it('rejecting changes nothing and says so in the chat', async () => {
    mockApi([['proposal', { ...marketCut }]]);
    render(<CopilotWorkspace mode="panel" />);
    await ask('Cut the market tonight');
    fireEvent.click(await screen.findByRole('button', { name: /^Reject$/i }));
    expect(await screen.findByText('Proposal rejected')).toBeInTheDocument();
    expect(screen.getByText('Nothing changed in the simulation.')).toBeInTheDocument();
    expect(useSimulationStore.getState().input.sectorCaps ?? []).toEqual([]);
    expect(screen.queryByRole('button', { name: /Approve & Apply Scenario/i })).toBeNull();
  });

  it('an offline fallback is a quiet note on the answer, not a red alert', async () => {
    mockApi([
      ['error', { code: 'PROVIDER_FALLBACK', reason: 'timeout' }],
      ['delta', { text: 'Offline answer.' }],
    ]);
    render(<CopilotWorkspace mode="panel" />);
    await ask('Compare the strategies');
    const note = await screen.findByRole('note');
    expect(note).toHaveTextContent('The Meta model took too long');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('the chat log is a bounded scroller in both modes (not a box that grows with the chat)', () => {
    mockApi([]);
    const { unmount } = render(<CopilotWorkspace mode="panel" />);
    expect(screen.getByRole('log').className).toMatch(/max-h-\[65dvh\]/);
    unmount();
    render(<CopilotWorkspace mode="full" />);
    // Wide screens: the workspace fills the main area and the log takes the rest.
    expect(screen.getByRole('log').className).toMatch(/xl:max-h-none/);
  });

  it('follow-up suggestions sit on one line under the chat', async () => {
    mockApi([['delta', { text: 'Done.' }]]);
    useSimulationStore.getState().run();
    render(<CopilotWorkspace mode="panel" />);
    await ask('Hello');
    await screen.findByText('Done.');
    const group = screen.getByRole('group', { name: 'SUGGESTED EXPLORATION PROMPTS' });
    expect(within(group).getAllByRole('button').length).toBeGreaterThan(0);
    expect(group.lastElementChild?.className).toContain('flex-nowrap');
  });

  it('a voice urgency order opens the fire dialog pre-filled (M3-T3)', async () => {
    vi.stubGlobal('MediaRecorder', FakeVoiceRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(async () => voiceStream) },
      configurable: true,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url) === '/api/voice')
          return {
            ok: true,
            json: async () => ({ text: "Au feu à l'école !" }),
          } as Response;
        if (String(url) === '/api/copilot/models') return json({ models: ['auto'] });
        if (String(url) === '/api/copilot/sessions') return json({ sessions: [] });
        return json({ success: true });
      })
    );
    render(<CopilotWorkspace mode="panel" />);
    fireEvent.click(screen.getByRole('button', { name: 'Voice input' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Stop recording' }));
    // The list opens at once with the detected sector highlighted; one click confirms.
    expect(await screen.findByText('Which sector is on fire?')).toBeInTheDocument();
    expect(screen.getByText('Detected from your voice — one click to confirm')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Primary School' }));
    expect(
      useSimulationStore
        .getState()
        .input.events.some((e) => e.type === 'fire' && e.sector === 'school')
    ).toBe(true);
    // The transcript still lands in the message field.
    expect(screen.getByRole('textbox')).toHaveValue("Au feu à l'école !");
  });

  it('vision observations render editable and propose through the dialog (M4-T4)', async () => {
    mockApi([
      [
        'perception',
        {
          kind: 'analyze',
          summary: 'Mock: partly cloudy sky.',
          observations: [{ label: 'cloud_cover', value: 60, unit: '%', confidence: 0.8 }],
          model: 'mock-vision',
          source: 'mock',
        },
      ],
      ['delta', { text: 'Clouds observed.' }],
    ]);
    render(<CopilotWorkspace mode="panel" />);
    await ask('How cloudy is the sky?');
    await screen.findByText('AI perception');
    fireEvent.change(screen.getByRole('spinbutton', { name: /cloud_cover/i }), {
      target: { value: '45' },
    });
    fireEvent.click(screen.getByRole('button', { name: /propose to the engine/i }));
    // The usual dialog takes over with the converted patch.
    fireEvent.click(await screen.findByRole('button', { name: /Approve & Apply Scenario/i }));
    expect(useSimulationStore.getState().input.events).toContainEqual(
      expect.objectContaining({ type: 'solar_drop', factor: 0.55 })
    );
  });

  it('hands-free: silence auto-stops and the transcript auto-sends (M3-T5)', async () => {
    vi.stubGlobal('MediaRecorder', FakeVoiceRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(async () => voiceStream) },
      configurable: true,
    });
    stubVoiceAudio([0.2, 0.2, 0.2, ...Array(30).fill(0.001)]);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url) === '/api/voice')
        return {
          ok: true,
          json: async () => ({ text: 'Compare the strategies' }),
        } as Response;
      if (String(url) === '/api/copilot' && init?.method === 'POST')
        return sse([['delta', { text: 'Auto-sent answer.' }]]);
      if (String(url) === '/api/copilot/models') return json({ models: ['auto'] });
      if (String(url) === '/api/copilot/sessions') return json({ sessions: [] });
      return json({ success: true });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<CopilotWorkspace mode="panel" />);
    const handsFree = screen.getByRole('button', { name: /hands-free/i });
    expect(handsFree).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(handsFree);
    expect(screen.getByRole('button', { name: /hands-free/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    // No second tap: silence ends the turn, the transcript sends by itself.
    fireEvent.click(screen.getByRole('button', { name: 'Voice input' }));
    await screen.findByText('Auto-sent answer.', undefined, { timeout: 8000 });
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url) === '/api/copilot' && String(init?.body).includes('Compare the strategies')
      )
    ).toBe(true);
  }, 15000);
});

describe('ConfirmProposalDialog after a decision', () => {
  beforeEach(() => resetSimulationStore());

  it('shows the decision badge and no action buttons', () => {
    render(
      <ConfirmProposalDialog
        proposal={marketCut}
        decision={{
          proposalId: 'PROP-MKT',
          status: 'rejected',
          items: [{ label: 'Market cap', current: 'None (uncapped)', proposed: '0 kW' }],
        }}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('None (uncapped)')).toBeInTheDocument(); // snapshot, not live values
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Generated visual in chat (M5-T2)', () => {
  beforeEach(() => resetSimulationStore());

  it('media event → visual card with AI badge', async () => {
    mockApi([
      ['delta', { text: '### What happened\nVoici le village ce soir.\n' }],
      [
        'media',
        {
          kind: 'village_tonight',
          imageUrl: 'https://img.example/village.webp',
          caption: 'Le village ce soir',
          overlay: null,
          resultId: 'SIM-1',
        },
      ],
    ]);
    render(<CopilotWorkspace mode="panel" />);
    await ask('Montre le village ce soir');

    expect(await screen.findByText('AI-generated')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Le village ce soir' })).toHaveAttribute(
      'src',
      'https://img.example/village.webp'
    );
  }, 15000);

  it('poster media event → overlay shows the engine cut hours', async () => {
    mockApi([
      ['delta', { text: '### What happened\nVoici l’affiche.\n' }],
      [
        'media',
        {
          kind: 'shedding_poster',
          imageUrl: 'https://img.example/poster.webp',
          caption: 'Load-shedding poster background',
          overlay: {
            cuts: [{ sector: 'market', fromHour: 18, toHour: 22, unservedKwh: 4.2 }],
          },
          resultId: 'SIM-1',
        },
      ],
    ]);
    render(<CopilotWorkspace mode="panel" />);
    await ask('Fais une affiche de délestage');

    expect(await screen.findByText(/18:00–22:00/)).toBeInTheDocument();
    expect(screen.getByText(/Local Market & Artisans/)).toBeInTheDocument();
  }, 15000);

  it('council event → bubbles with engine badges + verdict (M7-T1)', async () => {
    const impact = (sector: string, delta: number, unserved: number) => ({
      beforeResultId: 'SIM-A',
      afterResultId: 'SIM-B',
      strategyBefore: 'proportional',
      strategyAfter: 'proportional',
      socMinPctBefore: 20,
      socMinPctAfter: 20,
      unservedKwhBefore: 2,
      unservedKwhAfter: unserved,
      sectors: {
        [sector]: {
          servedKwhBefore: 10,
          servedKwhAfter: 10 + delta,
          servedKwhDelta: delta,
          offHoursBefore: 2,
          offHoursAfter: 0,
        },
      },
    });
    mockApi([
      ['delta', { text: '### What happened\nThe council convened.\n' }],
      [
        'council',
        {
          question: 'Who sheds?',
          rounds: 1,
          agents: [
            {
              sector: 'health',
              reason: 'Clinic first.',
              patch: {},
              impact: impact('health', 1.2, 0.4),
              mock: true,
            },
            {
              sector: 'market',
              reason: 'Stalls alive.',
              patch: {},
              impact: impact('market', 0.1, 1.8),
              mock: true,
            },
          ],
          verdict: { pick: 'health', synthesis: 'Engine favors health.', mock: true },
        },
      ],
    ]);
    render(<CopilotWorkspace mode="panel" />);
    await ask('Convene the council');

    expect(await screen.findByText('Sector council')).toBeInTheDocument();
    expect(screen.getByText(/served \+1\.2 kWh/)).toBeInTheDocument();
    expect(screen.getByText('Engine favors health.')).toBeInTheDocument();
  }, 15000);

  it('smoke on the photo → report dialog opens, nothing cut without a click (M8-T3)', async () => {
    mockApi([
      ['delta', { text: '### What happened\nSmoke on the photo.\n' }],
      [
        'perception',
        {
          kind: 'analyze',
          summary: 'Mock: smoke visible near a building, to verify.',
          observations: [{ label: 'smoke', value: true, confidence: 0.5 }],
          model: 'mock-vision',
          source: 'mock',
        },
      ],
    ]);
    render(<CopilotWorkspace mode="panel" />);
    await ask('Is there a fire on this photo?');

    // Wait for the vision block, then two report buttons: header's plus the block's own.
    await screen.findByText(/smoke visible/i);
    const reports = await screen.findAllByRole('button', { name: /report a fire/i });
    expect(reports).toHaveLength(2);
    // Vision never cuts by itself: no fire in the scenario, no alert banner.
    expect(useSimulationStore.getState().input.events?.some((e) => e.type === 'fire')).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();

    // The vision block's button (last in DOM order) opens the sector dialog.
    fireEvent.click(reports[reports.length - 1]!);
    expect(
      await screen.findByRole('group', { name: 'Which sector is on fire?' })
    ).toBeInTheDocument();
    // Still nothing until a sector is picked.
    expect(useSimulationStore.getState().input.events?.some((e) => e.type === 'fire')).toBe(false);
  }, 15000);
});
