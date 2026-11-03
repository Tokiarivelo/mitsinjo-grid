import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import { CopilotWorkspace } from '../ui/copilot-workspace';
import type { CopilotProposal } from '../types';
import type { SectorCap } from '@mitsinjo/engine';

vi.mock('../utils/wav', () => ({
  toVoiceWav: vi.fn(async () => new Blob([new Uint8Array(100)], { type: 'audio/wav' })),
}));

const marketCut: CopilotProposal & { patch: { sectorCaps: SectorCap[] } } = {
  proposalId: 'PROP-MKT-AUTO',
  patch: { sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 18, toHour: 22 }] },
  reason: 'Reduce load at evening peak',
};

const clinicCutViolation: CopilotProposal & { patch: { sectorCaps: SectorCap[] } } = {
  proposalId: 'PROP-CLN-VIOLATION',
  patch: { sectorCaps: [{ sector: 'health', maxKw: 0, fromHour: 18, toHour: 22 }] },
  reason: 'Forbidden cut of health clinic',
};

function sse(events: [string, unknown][]): Response {
  const body = [...events, ['done', {}] as [string, unknown]]
    .map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
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

function mockApi(chatEvents: [string, unknown][]) {
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

describe('Copilot in Autonomous Dispatch Mode (PA-T3c)', () => {
  beforeEach(() => {
    resetSimulationStore();
    useSimulationStore.getState().run();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('in autonomous mode, propose_change applies alone after constitution check and is logged', async () => {
    useSimulationStore.getState().setDispatchMode('autonomous');

    mockApi([
      ['delta', { text: 'I am cutting the market to relieve pressure.' }],
      ['proposal', marketCut],
    ]);

    render(<CopilotWorkspace mode="panel" />);
    await ask('Cut the market tonight');

    // Wait for the stream to process and message to appear
    expect(
      await screen.findByText('I am cutting the market to relieve pressure.')
    ).toBeInTheDocument();

    const state = useSimulationStore.getState();
    // Market should be automatically capped
    expect(state.input.sectorCaps?.some((c) => c.sector === 'market' && c.maxKw === 0)).toBe(true);

    // Dispatch log should have the operator-originated action
    const operatorLog = state.dispatchLog.find((e) => e.origin === 'operator');
    expect(operatorLog).toBeDefined();
    expect(operatorLog?.action?.kind).toBe('cap_sector');
    expect(operatorLog?.action?.sector).toBe('market');
    expect(operatorLog?.narration?.text).toBe('Reduce load at evening peak');
  });

  it('in autonomous mode, a proposal violating constitution is NOT auto-applied', async () => {
    useSimulationStore.getState().setDispatchMode('autonomous');

    mockApi([
      ['delta', { text: 'Cutting clinic.' }],
      ['proposal', clinicCutViolation],
    ]);

    render(<CopilotWorkspace mode="panel" />);
    await ask('Cut the clinic');

    expect(await screen.findByText('Cutting clinic.')).toBeInTheDocument();

    const state = useSimulationStore.getState();
    // Clinic must NEVER be cut!
    expect(
      Boolean(state.input.sectorCaps?.some((c) => c.sector === 'health' && c.maxKw === 0))
    ).toBe(false);

    const operatorLog = state.dispatchLog.find((e) => e.origin === 'operator');
    expect(operatorLog).toBeUndefined();
  });

  it('in manual mode, propose_change does NOT apply alone', async () => {
    useSimulationStore.getState().setDispatchMode('manual');

    mockApi([
      ['delta', { text: 'I propose cutting market.' }],
      ['proposal', marketCut],
    ]);

    render(<CopilotWorkspace mode="panel" />);
    await ask('Cut the market tonight');

    expect(await screen.findByText('I propose cutting market.')).toBeInTheDocument();

    const state = useSimulationStore.getState();
    // Market should NOT be auto-applied in manual mode
    expect(
      Boolean(state.input.sectorCaps?.some((c) => c.sector === 'market' && c.maxKw === 0))
    ).toBe(false);

    expect(state.dispatchLog).toHaveLength(0);
  });
});
