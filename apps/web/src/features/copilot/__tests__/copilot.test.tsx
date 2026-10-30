import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useSimulationStore, resetSimulationStore } from '@/stores';
import { CopilotPage } from '../index';
import { ToolActivity } from '../ui/tool-activity';
import { ChatMessageItem } from '../ui/chat-message-item';
import { ConfirmProposalDialog } from '../ui/confirm-proposal-dialog';
import { ContextPanel } from '../ui/context-panel';
import type { ChatMessageData } from '../types';

describe('Copilot Feature UI (P6-T6, P6-T8)', () => {
  beforeEach(() => {
    resetSimulationStore();
  });

  it('renders initial CopilotPage with title, AI EXPLANATION badge, and empty greeting', () => {
    render(<CopilotPage />);

    expect(screen.getByText('Mitsinjo Copilot')).toBeInTheDocument();
    expect(screen.getByText('AI EXPLANATION')).toBeInTheDocument();
    expect(screen.getAllByText('SIMULATED DATA').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Explore Simulation Trade-offs with AI')).toBeInTheDocument();
    expect(screen.getByText('SUGGESTED EXPLORATION PROMPTS')).toBeInTheDocument();
  });

  it('renders ToolActivity with deterministic status', () => {
    render(<ToolActivity activity={{ tool: 'get_sector_metrics', sector: 'health' }} />);

    expect(screen.getByRole('status')).toHaveTextContent(/Reviewing .+ sector data/);
    expect(screen.queryByText(/\bhealth\b/)).not.toBeInTheDocument();
    expect(screen.getByText('DETERMINISTIC')).toBeInTheDocument();
  });

  it('renders structured 4-section assistant message with computed evidence', () => {
    const assistantMsg: ChatMessageData = {
      id: 'assistant-1',
      role: 'assistant',
      content: '',
      sections: {
        whatHappened: 'During the afternoon solar drop, available power fell below demand.',
        computedEvidence: 'Result ID: SIM-123456\nTotal Demand: 120 kWh\nServed: 100 kWh',
        whyItMatters: 'Unserved energy threatens cold-chain vaccine storage at the health clinic.',
        exploreNext:
          'Switch allocation strategy to Essential-First to protect critical clinic power.',
      },
      evidence: [
        {
          resultId: 'SIM-123456',
          fields: {
            solarPeakKw: 34.8,
            criticalCoveragePct: 88.5,
          },
        },
        { resultId: 'SIM-abcdef', fields: { unservedKwh: 12.5 } },
      ],
    };

    render(<ChatMessageItem message={assistantMsg} />);

    expect(screen.getByText('What happened')).toBeInTheDocument();
    expect(
      screen.getByText('During the afternoon solar drop, available power fell below demand.')
    ).toBeInTheDocument();
    expect(screen.getByText('Computed evidence')).toBeInTheDocument();
    expect(screen.getByText('SIM-123456')).toBeInTheDocument();
    expect(screen.getByText('Solar Peak Capacity (kW)')).toBeInTheDocument();
    // Every tool result keeps its own evidence table (not just the last one).
    expect(screen.getByText('SIM-abcdef')).toBeInTheDocument();
    expect(screen.getByText('12.5')).toBeInTheDocument();
    expect(screen.getByText('Why it matters')).toBeInTheDocument();
    expect(screen.getByText('Explore next')).toBeInTheDocument();
    expect(screen.getByText('MITSINJO REASONING CORE')).toBeInTheDocument();
  });

  it('renders telemetry channel names as human-readable labeled text instead of raw identifiers', () => {
    const assistantMsg: ChatMessageData = {
      id: 'assistant-telemetry',
      role: 'assistant',
      content: '',
      sections: {
        whatHappened: 'Telemetry review completed.',
      },
      evidence: [
        {
          resultId: 'SIM-SEC-HEALTH',
          fields: {
            health_demandKwh: 20.4,
            health_servedKwh: 20.4,
            health_coveragePct: 100,
            health_unservedKwh: 0,
          },
        },
      ],
    };

    render(<ChatMessageItem message={assistantMsg} />);

    expect(screen.getByText('Health Clinic — Demand (kWh)')).toBeInTheDocument();
    expect(screen.getByText('Health Clinic — Energy Served (kWh)')).toBeInTheDocument();
    expect(screen.getByText('Health Clinic — Coverage Rate (%)')).toBeInTheDocument();
    expect(screen.getByText('Health Clinic — Unserved Energy (kWh)')).toBeInTheDocument();
    expect(screen.getAllByText('20.4').length).toBe(2);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders ConfirmProposalDialog with diff and approves proposal', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();

    render(
      <ConfirmProposalDialog
        proposal={{
          proposalId: 'PROP-01',
          patch: {
            solarDropPct: 40,
            dropStartHour: 13,
            dropDurationH: 2,
          },
          reason: 'Test proposal to protect health loads',
        }}
        onApprove={onApprove}
        onReject={onReject}
      />
    );

    expect(screen.getByText('PROPOSED SCENARIO MODIFICATION')).toBeInTheDocument();
    expect(screen.getByText('PROP-01')).toBeInTheDocument();
    expect(screen.getByText('Test proposal to protect health loads')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();

    // Click Approve
    const approveBtn = screen.getByRole('button', {
      name: /Approve & Apply Scenario/i,
    });
    fireEvent.click(approveBtn);
    expect(onApprove).toHaveBeenCalledTimes(1);

    // Click Reject
    const rejectBtn = screen.getByRole('button', { name: /Reject/i });
    fireEvent.click(rejectBtn);
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('renders strategy switch in proposal dialog and applies it to store (P6-T9)', () => {
    expect(useSimulationStore.getState().activeStrategy).toBe('proportional');

    render(
      <ConfirmProposalDialog
        proposal={{
          proposalId: 'PROP-STRAT',
          strategy: 'essential_first',
          reason: 'Switch to essential-first policy',
        }}
        onApprove={() => {
          useSimulationStore.getState().applyProposal(undefined, 'essential_first');
        }}
        onReject={() => {}}
      />
    );

    expect(screen.getByText('Dispatch Strategy')).toBeInTheDocument();
    expect(screen.getByText('essential_first')).toBeInTheDocument();

    const approveBtn = screen.getByRole('button', {
      name: /Approve & Apply Scenario/i,
    });
    fireEvent.click(approveBtn);

    expect(useSimulationStore.getState().activeStrategy).toBe('essential_first');
    expect(useSimulationStore.getState().status).toBe('complete');
  });

  it('renders priority and cap diffs in ConfirmProposalDialog (PY-T4)', () => {
    render(
      <ConfirmProposalDialog
        proposal={{
          proposalId: 'PROP-CAPS',
          patch: {
            priorities: {
              water: 'critical',
            },
            sectorCaps: [
              {
                sector: 'market',
                maxKw: 1.0,
                fromHour: 18,
                toHour: 22,
              },
            ],
          },
          reason: 'Limit market to 1 kW and raise water to critical',
        }}
        onApprove={() => {}}
        onReject={() => {}}
      />
    );

    expect(
      screen.getByText('Limit market to 1 kW and raise water to critical')
    ).toBeInTheDocument();
    expect(screen.getByText('1 kW (18:00–22:00)')).toBeInTheDocument();
  });

  it('renders lifeline diffs in ConfirmProposalDialog (PL-T14)', () => {
    render(
      <ConfirmProposalDialog
        proposal={{
          proposalId: 'PROP-LIFELINE',
          patch: {
            lifeline: {
              enabled: true,
              kw: {
                households: 0.5,
              },
            },
          },
          reason: 'Guarantee lighting floor for households',
        }}
        onApprove={() => {}}
        onReject={() => {}}
      />
    );

    expect(screen.getByText('Guarantee lighting floor for households')).toBeInTheDocument();
    expect(screen.getByText('0.5 kW')).toBeInTheDocument();
  });

  it('renders ContextPanel with active baseline, specs, and runs simulation', () => {
    render(<ContextPanel />);

    expect(screen.getByText('ACTIVE CONTEXT (COMPUTED)')).toBeInTheDocument();
    expect(screen.getByText('Active Baseline')).toBeInTheDocument();
    expect(screen.getByText('BASELINE')).toBeInTheDocument();

    // Initially no simulation results -> shows run simulation prompt
    const runBtn = screen.getByRole('button', { name: /Run Simulation/i });
    expect(runBtn).toBeInTheDocument();

    // Click Run Simulation
    fireEvent.click(runBtn);

    // Store updates to complete
    expect(useSimulationStore.getState().status).toBe('complete');
  });

  it('renders error state while keeping computed results available (P6-T8)', () => {
    const errorMsg: ChatMessageData = {
      id: 'error-1',
      role: 'error',
      content: 'AI provider rate limit reached.',
    };

    render(<ChatMessageItem message={errorMsg} />);

    expect(screen.getByText('Simulation Advisory Notice')).toBeInTheDocument();
    expect(screen.getByText('AI provider rate limit reached.')).toBeInTheDocument();
    expect(
      screen.getByText('Deterministic simulation results remain fully available and active.')
    ).toBeInTheDocument();
  });

  it('renders a translated error from its key, not raw server text', () => {
    render(
      <ChatMessageItem
        message={{ id: 'e2', role: 'error', content: '', errorKey: 'errorRateLimited' }}
      />
    );
    expect(screen.getByText(/Too many requests/)).toBeInTheDocument();
  });
});
