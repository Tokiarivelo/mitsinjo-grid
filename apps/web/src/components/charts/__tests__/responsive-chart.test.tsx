import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Bar, BarChart } from 'recharts';
import { ResponsiveChart } from '../responsive-chart';

/** jsdom has no layout: the observer reports this box. */
function stubSize(width: number, height: number) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private cb: ResizeObserverCallback) {}
      observe = () =>
        this.cb(
          [{ contentRect: { width, height } }] as unknown as ResizeObserverEntry[],
          {} as ResizeObserver
        );
      unobserve = () => {};
      disconnect = () => {};
    }
  );
}

const chart = () =>
  render(
    <div style={{ width: 300, height: 100 }}>
      <ResponsiveChart>
        <BarChart data={[{ v: 1 }]}>
          <Bar dataKey="v" />
        </BarChart>
      </ResponsiveChart>
    </div>
  );

describe('ResponsiveChart', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('draws no chart in a 0 × 0 box (before: Recharts warned in a hidden tab)', () => {
    stubSize(0, 0);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = chart();
    expect(container.querySelector('.recharts-responsive-container')).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('draws the chart once the box has a size', () => {
    stubSize(300, 100);
    const { container } = chart();
    expect(container.querySelector('.recharts-responsive-container')).not.toBeNull();
  });
});
