import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useElementHeight } from '../use-element-height';

let resize: (() => void) | null = null;

function Probe({ show }: { show: boolean }) {
  const { ref, height } = useElementHeight();
  return (
    <>
      {show && <div ref={ref} />}
      <output>{height}</output>
    </>
  );
}

describe('useElementHeight', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('follows the element height and drops to 0 when it unmounts', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          resize = cb;
        }
        observe() {}
        disconnect() {}
      }
    );
    let h = 120;
    const spy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => ({ height: h }) as DOMRect);
    const { rerender } = render(<Probe show />);
    expect(screen.getByRole('status')).toHaveTextContent('120');
    h = 64;
    act(() => resize?.());
    expect(screen.getByRole('status')).toHaveTextContent('64');
    rerender(<Probe show={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('0');
    spy.mockRestore();
  });
});
