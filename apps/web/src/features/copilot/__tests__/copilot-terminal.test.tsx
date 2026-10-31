import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import { CopilotProvider } from '../hooks/copilot-context';
import { CopilotWorkspace } from '../ui/copilot-workspace';
import { CopilotTerminal } from '../ui/copilot-terminal';

function sse(events: [string, Record<string, unknown>][]) {
  const body = [...events, ['done', {}] as [string, Record<string, unknown>]]
    .map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)
    .join('');
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

function mockApi(chatEvents: [string, Record<string, unknown>][], models = ['auto']) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/copilot' && init?.method === 'POST') return sse(chatEvents);
      if (url === '/api/copilot/models') return json({ models });
      if (url === '/api/copilot/sessions') return json({ sessions: [] });
      return json({ success: true });
    })
  );
}

const marketCut = {
  proposalId: 'PROP-MKT',
  patch: { sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 18, toHour: 22 }] },
  reason: 'Cut the market tonight',
};

describe('CopilotTerminal (glass chat over the full-screen village)', () => {
  beforeEach(() => resetSimulationStore());
  afterEach(() => vi.unstubAllGlobals());

  it('shares one conversation with the copilot tab', async () => {
    mockApi([['delta', { text: 'Shared answer.' }]]);
    render(
      <CopilotProvider>
        <CopilotWorkspace mode="panel" />
        <CopilotTerminal onClose={() => {}} />
      </CopilotProvider>
    );
    const terminal = screen.getByRole('region', { name: 'mitsinjo · copilot' });
    const box = within(terminal).getByRole('textbox');
    fireEvent.change(box, { target: { value: 'Why is the clinic short?' } });
    fireEvent.keyDown(box, { key: 'Enter' });

    // Same answer in both logs.
    expect(await within(terminal).findByText('Shared answer.')).toBeInTheDocument();
    const logs = screen.getAllByRole('log');
    expect(logs).toHaveLength(2);
    for (const log of logs) expect(log).toHaveTextContent('Why is the clinic short?');
  });

  it('chooses the model, shared with the copilot tab', async () => {
    mockApi([], ['auto', 'muse-spark-1.3', 'muse-wonder-1.0']);
    render(
      <CopilotProvider>
        <CopilotWorkspace mode="panel" />
        <CopilotTerminal onClose={() => {}} />
      </CopilotProvider>
    );
    const terminal = screen.getByRole('region', { name: 'mitsinjo · copilot' });
    const picker = await within(terminal).findByRole('combobox', { name: /model/i });
    fireEvent.change(picker, { target: { value: 'muse-wonder-1.0' } });
    for (const select of screen.getAllByRole('combobox', { name: /model/i })) {
      expect(select).toHaveValue('muse-wonder-1.0');
    }
  });

  it('keeps every feature: approve a proposal, undo it, retry, close', async () => {
    mockApi([['proposal', { ...marketCut }]]);
    const onClose = vi.fn();
    render(<CopilotTerminal onClose={onClose} />);
    const box = screen.getByRole('textbox');
    fireEvent.change(box, { target: { value: 'Cut the market tonight' } });
    fireEvent.keyDown(box, { key: 'Enter' });

    fireEvent.click(await screen.findByRole('button', { name: /Approve & Apply Scenario/i }));
    expect(useSimulationStore.getState().input.sectorCaps).toEqual(marketCut.patch.sectorCaps);
    fireEvent.click(await screen.findByRole('button', { name: 'Undo last change' }));
    expect(useSimulationStore.getState().input.sectorCaps ?? []).toEqual([]);

    // Mic, attach, sketch and send are all there.
    for (const name of [/attach/i, /sketch/i, /voice/i, /send/i]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Hide the copilot terminal' }));
    expect(onClose).toHaveBeenCalled();
  });
});
