import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import { ApplianceCurveChart } from '../ui/appliance-curve-chart';

/** jsdom has no layout: report a fixed box so ResponsiveContainer renders its bars. */
function stubSize(width = 320, height = 120) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private cb: ResizeObserverCallback) {}
      observe = () => {
        this.cb(
          [{ contentRect: { width, height } }] as unknown as ResizeObserverEntry[],
          {
            disconnect: () => {},
          } as unknown as ResizeObserver
        );
      };
      unobserve = () => {};
      disconnect = () => {};
    }
  );
}

describe('ApplianceCurveChart (PV-T11b)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders one bar per hour plus a text summary of the same numbers', () => {
    stubSize();
    const curve = Array.from({ length: 24 }, (_, h) => (h >= 6 && h < 18 ? 0.75 : 0));
    const { container } = render(
      <I18nProvider>
        <ApplianceCurveChart curve={curve} peakKw={0.75} dailyKwh={9} />
      </I18nProvider>
    );
    expect(screen.getByText('24 h load curve')).toBeTruthy();
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(24);
    expect(container.querySelector('p.sr-only')!.textContent).toContain('0.75');
    expect(container.querySelector('p.sr-only')!.textContent).toContain('9');
  });
});
