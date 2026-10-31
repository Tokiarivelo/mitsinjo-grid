import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import { CopilotWorkspace } from '../ui/copilot-workspace';
import { ConfirmProposalDialog } from '../ui/confirm-proposal-dialog';
import type { CopilotProposal } from '../types';
import type { SectorCap } from '@mitsinjo/engine';

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
    render(<CopilotWorkspace mode="panel" />);
    await ask('Hello');
    await screen.findByText('Done.');
    const group = screen.getByRole('group', { name: 'SUGGESTED EXPLORATION PROMPTS' });
    expect(within(group).getAllByRole('button').length).toBeGreaterThan(0);
    expect(group.lastElementChild?.className).toContain('flex-nowrap');
  });
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
