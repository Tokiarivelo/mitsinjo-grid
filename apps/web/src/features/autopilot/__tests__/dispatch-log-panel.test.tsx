import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { DispatchLogEntry } from '@mitsinjo/engine';
import { DispatchLogPanel } from '../ui/dispatch-log-panel';
import { useSimulationStore } from '@/stores';

const SAMPLE_ENTRIES: DispatchLogEntry[] = [
  {
    id: 'inc-d0-h14-fire-0',
    day: 0,
    hour: 14,
    mode: 'autonomous',
    origin: 'ai',
    incident: {
      kind: 'fire',
      severity: 'critical',
      day: 0,
      hour: 14,
      sector: 'market',
      evidence: { activeFires: 1 },
    },
    hash: 'deadbeef12345678',
  },
  {
    id: 'act-d0-h14-isolate_sector-1',
    day: 0,
    hour: 14,
    mode: 'autonomous',
    origin: 'ai',
    action: {
      kind: 'isolate_sector',
      sector: 'market',
      answers: 'fire',
      patch: { sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 14, toHour: 24 }] },
    },
    before: {
      resultId: 'r1',
      unservedKwh: 35.5,
      criticalUnservedKwh: 12.0,
      socEndPct: 40,
    },
    after: {
      resultId: 'r2',
      unservedKwh: 15.5,
      criticalUnservedKwh: 0.0,
      socEndPct: 45,
    },
    narration: {
      text: 'Isolating market immediately due to fire threat to protect clinic.',
      source: 'llm',
    },
    hash: 'cafebabe87654321',
  },
  {
    id: 'inc-d0-h18-overload-2',
    day: 0,
    hour: 18,
    mode: 'autonomous',
    origin: 'ai',
    incident: {
      kind: 'overload',
      severity: 'warning',
      day: 0,
      hour: 18,
      evidence: { peakKw: 10.640000000000002, solarKw: 0 },
    },
    hash: 'feedface11223344',
  },
];

describe('DispatchLogPanel (PA-T4b)', () => {
  beforeEach(() => {
    useSimulationStore.setState({
      dispatchLog: [],
      timeIndex: 0,
      selectedSector: null,
    });
  });

  it('renders empty state when dispatch log is empty', () => {
    render(<DispatchLogPanel />);
    expect(screen.getByText(/no events recorded yet/i)).toBeInTheDocument();
  });

  it('renders events with time, origin, severity and distinct AI text vs metrics', () => {
    useSimulationStore.setState({ dispatchLog: SAMPLE_ENTRIES });
    render(<DispatchLogPanel />);

    // Shows entries count
    expect(screen.getByText('3/3')).toBeInTheDocument();

    // Renders the hour
    expect(screen.getAllByText('14:00')).toHaveLength(2);
    expect(screen.getByText('18:00')).toBeInTheDocument();

    // Renders AI text distinctly
    expect(
      screen.getByText(/isolating market immediately due to fire threat/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/AI-GENERATED/i)).toBeInTheDocument();

    // Renders metrics (telemetry in monospace)
    expect(screen.getByText(/Unserved: 35.5 kWh/i)).toBeInTheDocument();
    expect(screen.getByText(/Unserved: 15.5 kWh/i)).toBeInTheDocument();
    expect(screen.getByText(/20.0 kWh saved/i)).toBeInTheDocument();

    // Renders evidence
    expect(screen.getByText(/activeFires/i)).toBeInTheDocument();
    // Float noise from the engine is rounded for display
    expect(screen.getByText('10.64')).toBeInTheDocument();
    expect(screen.queryByText('10.640000000000002')).toBeNull();
  });

  it('filters by severity: Critical only shows fire incident', () => {
    useSimulationStore.setState({ dispatchLog: SAMPLE_ENTRIES });
    render(<DispatchLogPanel />);

    const critFilterBtn = screen.getByRole('button', { name: /^critical$/i });
    fireEvent.click(critFilterBtn);

    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.queryByText(/overload/i)).toBeNull();
  });

  it('filters by type: Action only shows the isolation action', () => {
    useSimulationStore.setState({ dispatchLog: SAMPLE_ENTRIES });
    render(<DispatchLogPanel />);

    const actionsFilterBtn = screen.getByRole('button', { name: /^actions$/i });
    fireEvent.click(actionsFilterBtn);

    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.getByText(/isolate sector/i)).toBeInTheDocument();
  });

  it('clicking on an entry sets timeIndex and selectedSector in the store', () => {
    useSimulationStore.setState({ dispatchLog: SAMPLE_ENTRIES });
    render(<DispatchLogPanel />);

    const firstEntry = screen.getByTestId('dispatch-entry-inc-d0-h14-fire-0');
    fireEvent.click(firstEntry);

    expect(useSimulationStore.getState().timeIndex).toBe(14);
    expect(useSimulationStore.getState().selectedSector).toBe('market');
  });

  it('export buttons trigger downloads without errors', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    // jsdom has no object URLs: the shared download helper builds a Blob URL.
    const createUrl = vi.fn(() => 'blob:log');
    const revokeUrl = vi.fn();
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
    useSimulationStore.setState({ dispatchLog: SAMPLE_ENTRIES });
    render(<DispatchLogPanel />);

    const jsonBtn = screen.getByRole('button', { name: /export json/i });
    const csvBtn = screen.getByRole('button', { name: /export csv/i });

    expect(jsonBtn).not.toBeDisabled();
    expect(csvBtn).not.toBeDisabled();

    fireEvent.click(jsonBtn);
    expect(clickSpy).toHaveBeenCalled();

    fireEvent.click(csvBtn);
    expect(clickSpy).toHaveBeenCalledTimes(2);
    expect(createUrl).toHaveBeenCalledTimes(2);
    expect(revokeUrl).toHaveBeenCalledTimes(2);

    clickSpy.mockRestore();
  });

  it('clicking why button triggers onAskWhy callback (PA-T5b)', () => {
    const onAskWhy = vi.fn();
    useSimulationStore.setState({ dispatchLog: SAMPLE_ENTRIES });
    render(<DispatchLogPanel onAskWhy={onAskWhy} />);

    const whyBtn = screen.getByTestId('why-button-act-d0-h14-isolate_sector-1');
    expect(whyBtn).toBeInTheDocument();
    fireEvent.click(whyBtn);

    expect(onAskWhy).toHaveBeenCalledWith(SAMPLE_ENTRIES[1]);
  });

  it('shift report button opens shift report modal (PA-T5c)', () => {
    useSimulationStore.setState({ dispatchLog: SAMPLE_ENTRIES });
    render(<DispatchLogPanel />);

    const shiftReportBtn = screen.getByTestId('shift-report-button');
    expect(shiftReportBtn).toBeInTheDocument();
    fireEvent.click(shiftReportBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/critical energy preserved/i)).toBeInTheDocument();
  });
});
