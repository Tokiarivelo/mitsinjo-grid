import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PerceptionBlock } from '../perception-block';
import type { CopilotPerception } from '../../types';

const CLOUD: CopilotPerception = {
  kind: 'analyze',
  summary: 'Mock: partly cloudy sky.',
  observations: [{ label: 'cloud_cover', value: 60, unit: '%', confidence: 0.8 }],
  model: 'mock-vision',
  source: 'mock',
};

const METER: CopilotPerception = {
  kind: 'analyze',
  summary: 'Mock: a meter display is readable.',
  observations: [{ label: 'meter_reading', value: 2.5, unit: 'kW', confidence: 0.9 }],
  model: 'mock-vision',
  source: 'mock',
};

describe('PerceptionBlock (M4-T4)', () => {
  it('shows the observations and proposes the converted patch with the edited value', () => {
    const onPropose = vi.fn();
    render(<PerceptionBlock perception={CLOUD} onPropose={onPropose} />);
    expect(screen.getByText('AI perception')).toBeInTheDocument();
    expect(screen.getByText('Mock: partly cloudy sky.')).toBeInTheDocument();
    const value = screen.getByRole('spinbutton', { name: /cloud_cover/i });
    expect(value).toHaveValue(60);
    fireEvent.change(value, { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: /propose to the engine/i }));
    expect(onPropose).toHaveBeenCalledWith(
      { solarDropPct: 45 },
      expect.stringContaining('cloud_cover')
    );
  });

  it('a meter reading needs its sector before proposing', () => {
    const onPropose = vi.fn();
    render(<PerceptionBlock perception={METER} onPropose={onPropose} />);
    const propose = screen.getByRole('button', { name: /propose to the engine/i });
    expect(propose).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: /meter sector/i }), {
      target: { value: 'school' },
    });
    fireEvent.click(propose);
    expect(onPropose).toHaveBeenCalledWith(
      { meterReadings: { school: new Array(24).fill(2.5) } },
      expect.stringContaining('meter_reading')
    );
  });

  it('says what cannot convert and never proposes air', () => {
    const onPropose = vi.fn();
    render(
      <PerceptionBlock
        perception={{
          kind: 'analyze',
          summary: 'Mock: smoke visible.',
          observations: [{ label: 'smoke', value: true, confidence: 0.5 }],
          model: 'mock-vision',
          source: 'mock',
        }}
        onPropose={onPropose}
      />
    );
    expect(screen.getByText(/not convertible/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /propose to the engine/i })).toBeDisabled();
    expect(onPropose).not.toHaveBeenCalled();
  });

  it('segment kind: count line + view-on-photo opens the lightbox with masks (M8-T1)', () => {
    const onPropose = vi.fn();
    const onMediaClick = vi.fn();
    render(
      <PerceptionBlock
        perception={{
          kind: 'segment',
          concept: 'roof',
          count: 2,
          imageUrl: 'https://example.com/roof.png',
          imageWidth: 1000,
          imageHeight: 800,
          instances: [
            { box: { x1: 100, y1: 80, x2: 500, y2: 400 }, confidence: 0.9 },
            { box: { x1: 0, y1: 0, x2: 10, y2: 10 }, outline: 'M0 0H0.01V0.01H0Z' },
          ],
          model: 'mock-sam',
          source: 'mock',
        }}
        onPropose={onPropose}
        onMediaClick={onMediaClick}
      />
    );
    expect(screen.getByText(/2 × roof/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /report a fire/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /view on photo/i }));
    expect(onMediaClick).toHaveBeenCalledWith({
      url: 'https://example.com/roof.png',
      type: 'image',
      title: 'roof',
      masks: [
        {
          box: { x1: 100, y1: 80, x2: 500, y2: 400 },
          imageWidth: 1000,
          imageHeight: 800,
        },
        {
          box: { x1: 0, y1: 0, x2: 10, y2: 10 },
          outline: 'M0 0H0.01V0.01H0Z',
          imageWidth: 1000,
          imageHeight: 800,
        },
      ],
    });
  });

  it('analyze with smoke: report-a-fire button, never automatic (M8-T3)', () => {
    const onPropose = vi.fn();
    const onReportFire = vi.fn();
    render(
      <PerceptionBlock
        perception={{
          kind: 'analyze',
          summary: 'Mock: smoke visible near a building, to verify.',
          observations: [{ label: 'smoke', value: true, confidence: 0.5 }],
          model: 'mock-vision',
          source: 'mock',
        }}
        onPropose={onPropose}
        onReportFire={onReportFire}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /report a fire/i }));
    expect(onReportFire).toHaveBeenCalledTimes(1);
    // The button only opens the dialog: nothing is proposed or applied by itself.
    expect(onPropose).not.toHaveBeenCalled();
  });

  it('analyze without fire signs: no report button (M8-T3)', () => {
    render(
      <PerceptionBlock
        perception={{
          kind: 'analyze',
          summary: 'Mock: cloud cover 60%.',
          observations: [{ label: 'cloud_cover', value: 60, unit: '%', confidence: 0.5 }],
          model: 'mock-vision',
          source: 'mock',
        }}
        onPropose={vi.fn()}
        onReportFire={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /report a fire/i })).toBeNull();
  });
});
