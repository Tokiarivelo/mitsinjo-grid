import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShiftReportDialog } from '../ui/shift-report-dialog';
import type { ShiftReport } from '@/lib/dispatch-log';

describe('ShiftReportDialog (PA-T5c)', () => {
  const sampleReport: ShiftReport = {
    day: 0,
    totalIncidents: 3,
    criticalIncidents: 1,
    warningIncidents: 2,
    infoIncidents: 0,
    totalActions: 2,
    savedKwh: 25.5,
    criticalSavedKwh: 12.0,
    minSocPct: 35,
    finalSocPct: 48,
    affectedSectors: ['market', 'industry'],
    keyActions: [
      {
        id: 'act-1',
        hour: 14,
        actionKind: 'isolate_sector',
        sector: 'market',
        savedKwh: 20.0,
      },
      {
        id: 'act-2',
        hour: 17,
        actionKind: 'shed_flexible',
        sector: 'industry',
        savedKwh: 5.5,
      },
    ],
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ShiftReportDialog isOpen={false} onClose={vi.fn()} report={sampleReport} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with metrics, counterfactual and key interventions when isOpen is true', () => {
    render(<ShiftReportDialog isOpen={true} onClose={vi.fn()} report={sampleReport} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/critical energy preserved/i)).toBeInTheDocument();
    expect(screen.getByText(/Market/i)).toBeInTheDocument();
    expect(screen.getByText(/Small Factory/i)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<ShiftReportDialog isOpen={true} onClose={onClose} report={sampleReport} />);

    const closeBtn = screen.getAllByRole('button', { name: /close/i })[0];
    expect(closeBtn).toBeDefined();
    fireEvent.click(closeBtn!);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onAskCopilot when discuss button is clicked', () => {
    const onAskCopilot = vi.fn();
    const onClose = vi.fn();
    render(
      <ShiftReportDialog
        isOpen={true}
        onClose={onClose}
        report={sampleReport}
        onAskCopilot={onAskCopilot}
      />
    );

    const discussBtn = screen.getByRole('button', { name: /discuss with copilot/i });
    fireEvent.click(discussBtn);
    expect(onClose).toHaveBeenCalled();
    expect(onAskCopilot).toHaveBeenCalledWith(expect.stringContaining('day 1 shift report'));
  });
});
