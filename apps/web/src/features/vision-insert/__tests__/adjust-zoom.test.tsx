import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import type { ApplianceDetection } from '@/lib/vision';
vi.mock('../utils/prepare-image', () => ({
  prepareVisionImage: vi.fn(async () => new Blob([new Uint8Array(4)], { type: 'image/jpeg' })),
}));

import {
  DetectionCanvas,
  KEY_STEP,
  photoWidth,
  stepZoom,
  useVisionSession,
  type DetectionCanvasProps,
} from '../index';

const fridge: ApplianceDetection = {
  id: 'det-1',
  label: 'Fridge',
  category: 'fridge',
  box: { x: 0.1, y: 0.1, w: 0.2, h: 0.5 },
  outline: 'M0.1 0.1L0.3 0.1L0.3 0.6Z',
};

const renderCanvas = (props: Partial<DetectionCanvasProps> = {}) =>
  render(
    <I18nProvider>
      <DetectionCanvas
        imageUrl="data:image/png;base64,AA"
        status="ready"
        detections={[fridge]}
        selectedId="det-1"
        onSelect={() => {}}
        onSendShapes={() => true}
        {...props}
      />
    </I18nProvider>
  );

describe('photo zoom', () => {
  it('steps through the zoom levels and stops at the ends', () => {
    expect(stepZoom(1, 1)).toBe(1.5);
    expect(stepZoom(4, 1)).toBe(4);
    expect(stepZoom(2, -1)).toBe(1.5);
    expect(stepZoom(1, -1)).toBe(1);
  });

  it('fits a tall photo to the height limit, then multiplies by the zoom', () => {
    expect(photoWidth(null, 1)).toBe('calc(100% * 1)');
    expect(photoWidth(0.75, 2)).toBe('calc(min(100%, 60vh * 0.7500) * 2)');
  });

  it('zoom buttons change the photo width; 100 % goes back; − is off at fit', () => {
    renderCanvas();
    const out = screen.getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement;
    expect(out.disabled).toBe(true);
    const img = screen.getByAltText(/photo/i);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    // jsdom folds the calc (no image size yet: fitted width = 100 %).
    expect((img.parentElement as HTMLElement).style.width).toBe('calc(200%)');
    expect(screen.getByText('200 %')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to 100 % (now 200 %)' }));
    expect((img.parentElement as HTMLElement).style.width).toBe('calc(100%)');
  });
});

describe('adjust a box made by the AI', () => {
  it('moves the box with the keyboard and saves it; the outline layer shows the editor instead', () => {
    const onAdjustBox = vi.fn();
    renderCanvas({ onAdjustBox });
    fireEvent.click(screen.getByRole('button', { name: 'Adjust the box of Fridge' }));
    expect(screen.getByText('Adjusting the box of Fridge')).toBeTruthy();
    // The draw button is replaced while adjusting.
    expect(screen.queryByRole('button', { name: /Draw missing objects/ })).toBeNull();
    const area = screen.getByRole('application');
    fireEvent.keyDown(area, { key: 'ArrowRight' });
    fireEvent.keyDown(area, { key: 'ArrowDown', shiftKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Save the box' }));
    expect(onAdjustBox).toHaveBeenCalledTimes(1);
    const [id, box] = onAdjustBox.mock.calls[0]!;
    expect(id).toBe('det-1');
    expect(box.x).toBeCloseTo(0.1 + KEY_STEP);
    expect(box.w).toBeCloseTo(0.2);
    expect(box.h).toBeCloseTo(0.5 + KEY_STEP);
    expect(screen.queryByRole('application')).toBeNull();
  });

  it('cancel keeps the AI box; no button without a handler or nothing selected', () => {
    const onAdjustBox = vi.fn();
    const { unmount } = renderCanvas({ onAdjustBox });
    fireEvent.click(screen.getByRole('button', { name: 'Adjust the box of Fridge' }));
    fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onAdjustBox).not.toHaveBeenCalled();
    unmount();
    renderCanvas();
    expect(screen.queryByRole('button', { name: /Adjust the box/ })).toBeNull();
  });

  it('pan toggle only while editing a zoomed photo; it lets pointers through', () => {
    renderCanvas({ onAdjustBox: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: 'Adjust the box of Fridge' }));
    expect(screen.queryByRole('button', { name: /Move the photo/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    const pan = screen.getByRole('button', { name: /Move the photo/ });
    fireEvent.click(pan);
    expect(pan.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('application').className).toContain('pointer-events-none');
  });
});

describe('useVisionSession.adjustBox', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    global.fetch = vi.fn(
      async () =>
        new Response(
          `event: vision_detections\ndata: ${JSON.stringify({ phase: 'boxes', detections: [fridge], source: 'mock', model: 'm' })}\n\n`,
          { headers: { 'Content-Type': 'text/event-stream' } }
        )
    ) as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('the corrected box replaces the model one, drops its outline, and is kept for this photo only', async () => {
    const { result, rerender } = renderHook(({ url }) => useVisionSession(url), {
      initialProps: { url: 'data:image/png;base64,AA' as string | null },
    });
    await waitFor(() => expect(result.current.detections).toHaveLength(1));
    const box = { x: 0.2, y: 0.2, w: 0.1, h: 0.3 };
    act(() => result.current.adjustBox('det-1', box));
    expect(result.current.detections[0]).toMatchObject({ id: 'det-1', box, adjusted: true });
    expect(result.current.detections[0]!.outline).toBeUndefined();
    rerender({ url: 'data:image/png;base64,BB' });
    await waitFor(() => expect(result.current.detections).toHaveLength(1));
    expect(result.current.detections[0]!.box).toEqual(fridge.box);
  });
});
