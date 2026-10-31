import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import { ApplianceDetectionSchema, type ApplianceDetection } from '@/lib/vision';
vi.mock('../utils/prepare-image', () => ({
  prepareVisionImage: vi.fn(async () => new Blob([new Uint8Array(4)], { type: 'image/jpeg' })),
}));

import {
  boxFromPoints,
  DEFAULT_MANUAL_BOX,
  DetectionCanvas,
  manualDetection,
  MAX_MANUAL_BOXES,
  toNormPoint,
  useBoxDrawing,
  useVisionSession,
  type DetectionCanvasProps,
} from '../index';

const fridge: ApplianceDetection = {
  id: 'det-1',
  label: 'Fridge',
  category: 'fridge',
  box: { x: 0.1, y: 0.1, w: 0.2, h: 0.5 },
};
const sseBody = (detections: ApplianceDetection[]) =>
  `event: vision_detections\ndata: ${JSON.stringify({ phase: 'boxes', detections, source: 'mock', model: 'm' })}\n\nevent: done\ndata: {}\n\n`;

// jsdom has no PointerEvent: fireEvent.pointer* would drop clientX/clientY.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

const originalFetch = global.fetch;
beforeEach(() => {
  global.fetch = vi.fn(
    async () =>
      new Response(sseBody([fridge]), { headers: { 'Content-Type': 'text/event-stream' } })
  ) as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

const rect = { left: 100, top: 50, width: 200, height: 100 };

describe('manual box utils (PV-T8)', () => {
  it('maps a pointer to photo fractions, clamped to the photo', () => {
    expect(toNormPoint(150, 75, rect)).toEqual({ x: 0.25, y: 0.25 });
    expect(toNormPoint(0, 500, rect)).toEqual({ x: 0, y: 1 });
    expect(toNormPoint(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('builds the box from corners in any order; a tap is not a box', () => {
    const box = boxFromPoints({ x: 0.6, y: 0.8 }, { x: 0.2, y: 0.3 })!;
    expect(box.x).toBe(0.2);
    expect(box.y).toBe(0.3);
    expect(box.w).toBeCloseTo(0.4);
    expect(box.h).toBeCloseTo(0.5);
    expect(boxFromPoints({ x: 0.5, y: 0.5 }, { x: 0.51, y: 0.9 })).toBeNull();
  });

  it('a drawn box becomes a valid detection like the AI ones, marked manual, no power', () => {
    const d = manualDetection({
      id: 'manual-1',
      box: DEFAULT_MANUAL_BOX,
      category: 'water_pump',
      label: '  Pump in the shed with a very long name over forty chars  ',
    });
    expect(ApplianceDetectionSchema.parse(d)).toEqual(d);
    expect(d).toMatchObject({ kind: 'appliance', category: 'water_pump', manual: true });
    expect(d.label).toHaveLength(40);
    expect(JSON.stringify(d)).not.toMatch(/watt|kw/i);
  });

  it('the server schema accepts manual only as true', () => {
    expect(ApplianceDetectionSchema.safeParse({ ...fridge, manual: false }).success).toBe(false);
  });
});

describe('useBoxDrawing', () => {
  const ev = (clientX: number, clientY: number) =>
    ({
      clientX,
      clientY,
      pointerId: 1,
      preventDefault: () => {},
      currentTarget: { getBoundingClientRect: () => rect, setPointerCapture: () => {} },
    }) as unknown as React.PointerEvent<HTMLElement>;

  it('drag → draft while moving, box on release; a tap keeps the last box; clear', () => {
    const { result } = renderHook(() => useBoxDrawing());
    act(() => result.current.handlers.onPointerDown(ev(120, 60)));
    act(() => result.current.handlers.onPointerMove(ev(200, 100)));
    expect(result.current.box).toBeNull();
    expect(result.current.shown?.x).toBeCloseTo(0.1);
    act(() => result.current.handlers.onPointerUp(ev(220, 110)));
    expect(result.current.box).toMatchObject({ x: 0.1, y: 0.1 });
    expect(result.current.box!.w).toBeCloseTo(0.5);
    act(() => result.current.handlers.onPointerDown(ev(150, 75)));
    act(() => result.current.handlers.onPointerUp(ev(150, 75)));
    expect(result.current.box!.w).toBeCloseTo(0.5);
    act(() => result.current.clear());
    expect(result.current.shown).toBeNull();
  });
});

describe('useVisionSession manual boxes', () => {
  it('adds after the AI objects, selects it, removes it; a new photo starts empty', async () => {
    const { result, rerender } = renderHook(({ url }) => useVisionSession(url), {
      initialProps: { url: 'data:a' as string | null },
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    let id: string | null = null;
    act(() => {
      id = result.current.addManual(DEFAULT_MANUAL_BOX, 'lamp', 'Lamp');
    });
    expect(result.current.detections.map((d) => d.id)).toEqual(['det-1', id]);
    expect(result.current.selected).toMatchObject({ id, manual: true, category: 'lamp' });
    act(() => result.current.removeManual(id!));
    expect(result.current.detections).toEqual([fridge]);
    expect(result.current.selected).toBeNull();

    act(() => {
      result.current.addManual(DEFAULT_MANUAL_BOX, 'fan', 'Fan');
    });
    rerender({ url: 'data:b' });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.detections.some((d) => d.manual)).toBe(false);
  });

  it(`stops at ${MAX_MANUAL_BOXES} boxes`, async () => {
    const { result } = renderHook(() => useVisionSession('data:a'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    for (let i = 0; i < MAX_MANUAL_BOXES; i++)
      act(() => {
        result.current.addManual(DEFAULT_MANUAL_BOX, 'lamp', `Lamp ${i}`);
      });
    expect(result.current.canAddManual).toBe(false);
    let id: string | null = 'x';
    act(() => {
      id = result.current.addManual(DEFAULT_MANUAL_BOX, 'lamp', 'One more');
    });
    expect(id).toBeNull();
    expect(result.current.detections).toHaveLength(MAX_MANUAL_BOXES + 1);
  });
});

describe('DetectionCanvas draw mode (PV-T8)', () => {
  function setup(props: Partial<DetectionCanvasProps> = {}) {
    const onAddManual = vi.fn();
    const onRemoveManual = vi.fn();
    const utils = render(
      <I18nProvider>
        <DetectionCanvas
          imageUrl="data:image/jpeg;base64,AA"
          status="ready"
          detections={[fridge]}
          selectedId={null}
          onSelect={() => {}}
          onAddManual={onAddManual}
          onRemoveManual={onRemoveManual}
          {...props}
        />
      </I18nProvider>
    );
    return { ...utils, onAddManual, onRemoveManual };
  }

  it('drag a box, pick a category → onAddManual with the box and the category name', () => {
    const { onAddManual } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Draw a missing object' }));
    const area = screen.getByRole('application', { name: /drag around the missing object/ });
    area.getBoundingClientRect = () => ({ ...rect, right: 300, bottom: 150 }) as DOMRect;
    fireEvent.pointerDown(area, { clientX: 120, clientY: 60 });
    fireEvent.pointerMove(area, { clientX: 200, clientY: 100 });
    fireEvent.pointerUp(area, { clientX: 200, clientY: 100 });
    expect(screen.getByText(/Box drawn/)).toBeTruthy();
    const add = screen.getByRole('button', { name: 'Add object' }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'water_pump' } });
    fireEvent.click(add);
    expect(onAddManual).toHaveBeenCalledTimes(1);
    const [box, category, label] = onAddManual.mock.calls[0]!;
    expect(box.x).toBeCloseTo(0.1);
    expect(box.w).toBeCloseTo(0.4);
    expect(category).toBe('water_pump');
    expect(label).toBe('Water pump');
    // Form closes, draw button is back.
    expect(screen.getByRole('button', { name: 'Draw a missing object' })).toBeTruthy();
  });

  it('keyboard: no box drawn → centred box, custom name; cancel adds nothing', () => {
    const { onAddManual } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Draw a missing object' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onAddManual).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Draw a missing object' }));
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'lamp' } });
    fireEvent.change(screen.getByLabelText('Name (optional)'), {
      target: { value: 'Porch light' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add object' }));
    expect(onAddManual).toHaveBeenCalledWith(DEFAULT_MANUAL_BOX, 'lamp', 'Porch light');
  });

  it('a manual item is dashed, tagged « Added by you » and removable', () => {
    const drawn = manualDetection({
      id: 'manual-1',
      box: DEFAULT_MANUAL_BOX,
      category: 'lamp',
      label: 'Porch light',
    });
    const { container, onRemoveManual } = setup({ detections: [fridge, drawn] });
    const path = container.querySelector('path[data-detection="manual-1"]')!;
    expect(path.getAttribute('stroke-dasharray')).toBe('6 4');
    expect(screen.getByText('Added by you')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Porch light' }));
    expect(onRemoveManual).toHaveBeenCalledWith('manual-1');
    // AI objects have no remove button.
    expect(screen.queryByRole('button', { name: 'Remove Fridge' })).toBeNull();
  });

  it('AI failed: drawing still works and drawn boxes stay listed', () => {
    const drawn = manualDetection({
      id: 'm',
      box: DEFAULT_MANUAL_BOX,
      category: 'tv',
      label: 'TV',
    });
    setup({ status: 'error', detections: [drawn] });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Objects found (1)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Draw a missing object' })).toBeTruthy();
  });

  it('limit reached: draw button disabled with a note; no handler = no button', () => {
    setup({ canAddManual: false });
    expect(
      (screen.getByRole('button', { name: 'Draw a missing object' }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(screen.getByText(/Limit reached/)).toBeTruthy();
  });

  it('no onAddManual or still loading → no draw button', () => {
    const { rerender } = setup({ onAddManual: undefined });
    expect(screen.queryByRole('button', { name: 'Draw a missing object' })).toBeNull();
    rerender(
      <I18nProvider>
        <DetectionCanvas
          imageUrl="data:x"
          status="loading"
          detections={[]}
          selectedId={null}
          onSelect={() => {}}
          onAddManual={() => {}}
        />
      </I18nProvider>
    );
    expect(screen.queryByRole('button', { name: 'Draw a missing object' })).toBeNull();
  });
});
