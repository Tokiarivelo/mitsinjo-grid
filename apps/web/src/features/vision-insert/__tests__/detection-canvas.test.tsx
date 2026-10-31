import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import type { ApplianceDetection } from '@/lib/vision';
import { DetectionCanvas, type DetectionCanvasProps } from '../index';

const fridge: ApplianceDetection = {
  id: 'det-1',
  label: 'Fridge',
  category: 'fridge',
  box: { x: 0.06, y: 0.22, w: 0.2, h: 0.66 },
  outline: 'M0.06 0.22L0.26 0.22L0.26 0.88Z',
};
const tv: ApplianceDetection = {
  id: 'det-2',
  label: 'TV',
  category: 'tv',
  box: { x: 0.42, y: 0.3, w: 0.26, h: 0.24 },
};

function setup(props: Partial<DetectionCanvasProps> = {}) {
  const onSelect = vi.fn();
  const onRetry = vi.fn();
  const utils = render(
    <I18nProvider>
      <DetectionCanvas
        imageUrl="data:image/jpeg;base64,AA"
        status="ready"
        detections={[fridge, tv]}
        selectedId={null}
        onSelect={onSelect}
        onRetry={onRetry}
        {...props}
      />
    </I18nProvider>
  );
  const path = (id: string) => utils.container.querySelector(`path[data-detection="${id}"]`)!;
  return { ...utils, onSelect, onRetry, path };
}

describe('DetectionCanvas (PV-T7)', () => {
  it('draws the SAM outline, or the box when there is none, labelled as AI perception', () => {
    const { path } = setup();
    expect(path('det-1').getAttribute('d')).toBe(fridge.outline);
    expect(path('det-2').getAttribute('d')).toBe('M0.42 0.3H0.6799999999999999V0.54H0.42Z');
    expect(screen.getByText('AI perception · to verify')).toBeTruthy();
    expect(screen.getByText('Appliances found (2)')).toBeTruthy();
  });

  it('hover on an outline highlights it and shows its label chip', () => {
    const { path } = setup();
    expect(screen.queryByText('TV · Television')).toBeNull();
    fireEvent.pointerEnter(path('det-2'));
    expect(screen.getByText('TV · Television')).toBeTruthy();
    expect(path('det-2').getAttribute('stroke-width')).toBe('3');
    fireEvent.pointerLeave(path('det-2'));
    expect(screen.queryByText('TV · Television')).toBeNull();
    // Label equal to its category: no repeated "Fridge · Fridge".
    fireEvent.pointerEnter(path('det-1'));
    expect(screen.queryByText('Fridge · Fridge')).toBeNull();
  });

  it('keyboard: focusing a list item highlights it; Enter/click selects', () => {
    const { onSelect } = setup();
    const item = screen.getByRole('button', { name: /TV\s*Television/ });
    fireEvent.focus(item);
    expect(screen.getByText('TV · Television')).toBeTruthy();
    fireEvent.click(item);
    expect(onSelect).toHaveBeenCalledWith('det-2');
  });

  it('tap on an outline selects; the selected item is marked', () => {
    const { onSelect, path } = setup({ selectedId: 'det-1' });
    fireEvent.click(path('det-2'));
    expect(onSelect).toHaveBeenCalledWith('det-2');
    expect(screen.getByRole('button', { name: /Fridge/ }).getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(path('det-1').getAttribute('class')).toContain('stroke-solar-amber');
  });

  it('empty result: message, no overlay', () => {
    const { container } = setup({ detections: [] });
    expect(screen.getByText('No appliance found on this photo.')).toBeTruthy();
    expect(container.querySelector('svg path[data-detection]')).toBeNull();
  });

  it('error state: alert with retry', () => {
    const { onRetry } = setup({ status: 'error', detections: [] });
    expect(screen.getByRole('alert').textContent).toContain('Appliance detection failed.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('loading shows a status and no outlines; refining keeps outlines with a note; demo note', () => {
    const { rerender, container } = setup({ status: 'loading', detections: [] });
    expect(screen.getByRole('status').textContent).toContain('Looking for appliances…');
    rerender(
      <I18nProvider>
        <DetectionCanvas
          imageUrl="data:x"
          status="refining"
          detections={[fridge]}
          selectedId={null}
          onSelect={() => {}}
          isDemo
        />
      </I18nProvider>
    );
    expect(screen.getByText('Refining outlines…')).toBeTruthy();
    expect(screen.getByText(/Demo detections/)).toBeTruthy();
    expect(container.querySelectorAll('path[data-detection]')).toHaveLength(1);
  });
});
