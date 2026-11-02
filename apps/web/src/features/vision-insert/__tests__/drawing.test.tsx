import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { I18nProvider } from '@/lib/i18n';
import { polygonBounds, VisionRegionSchema, type ApplianceDetection } from '@/lib/vision';
vi.mock('../utils/prepare-image', () => ({
  prepareVisionImage: vi.fn(async () => new Blob([new Uint8Array(4)], { type: 'image/jpeg' })),
}));

import {
  addStrokePoint,
  boxPoints,
  buildEdgeMap,
  DEFAULT_BOX,
  DetectionCanvas,
  finishStroke,
  KEY_STEP,
  moveShape,
  resizeShape,
  shapeToDetection,
  shapeToRegion,
  simplify,
  snapToEdge,
  toNormPoint,
  useShapeEditor,
  useVisionSession,
  type DetectionCanvasProps,
  type DrawnShape,
  type Pt,
} from '../index';

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

const fridge: ApplianceDetection = {
  id: 'det-1',
  label: 'Fridge',
  category: 'fridge',
  box: { x: 0.1, y: 0.1, w: 0.2, h: 0.5 },
};
const rect = { left: 100, top: 50, width: 200, height: 100 };
const sse = (...events: [string, unknown][]) =>
  new Response(events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join(''), {
    headers: { 'Content-Type': 'text/event-stream' },
  });

const originalFetch = global.fetch;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () =>
    sse(['vision_detections', { phase: 'boxes', detections: [fridge], source: 'mock', model: 'm' }])
  );
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

describe('shape geometry (PV-T8)', () => {
  it('pointer → photo fractions, clamped', () => {
    expect(toNormPoint(150, 75, rect)).toEqual([0.25, 0.25]);
    expect(toNormPoint(0, 500, rect)).toEqual([0, 1]);
  });

  it('box from two corners in any order; a tap is not a shape', () => {
    expect(boxPoints([0.6, 0.8], [0.2, 0.3])).toEqual([
      [0.2, 0.3],
      [0.6, 0.3],
      [0.6, 0.8],
      [0.2, 0.8],
    ]);
    expect(
      finishStroke('box', [
        [0.5, 0.5],
        [0.505, 0.9],
      ])
    ).toBeNull();
    expect(
      finishStroke('box', [
        [0.2, 0.2],
        [0.4, 0.5],
      ])
    ).toHaveLength(4);
  });

  it('free hand: close points skipped, straight runs simplified, tiny scribble dropped', () => {
    let pts: Pt[] = [[0.1, 0.1]];
    pts = addStrokePoint(pts, [0.1001, 0.1001]);
    expect(pts).toHaveLength(1);
    const line: Pt[] = [0, 1, 2, 3, 4, 5].map((i) => [0.1 + i * 0.05, 0.1] as Pt);
    expect(simplify(line)).toEqual([line[0], line[5]]);
    const tri: Pt[] = [
      [0.1, 0.1],
      [0.3, 0.1],
      [0.3, 0.2],
      [0.2, 0.3],
      [0.1, 0.1],
    ];
    expect(finishStroke('free', tri)!.length).toBeGreaterThanOrEqual(3);
    expect(
      finishStroke('free', [
        [0.1, 0.1],
        [0.11, 0.105],
        [0.105, 0.11],
      ])
    ).toBeNull();
  });

  it('move stays inside the photo; resize keeps the opposite corner and the shape', () => {
    const moved = moveShape(DEFAULT_BOX, 1, 0);
    expect(polygonBounds(moved).x + polygonBounds(moved).w).toBeCloseTo(1);
    const tri: Pt[] = [
      [0.2, 0.2],
      [0.4, 0.2],
      [0.3, 0.4],
    ];
    const big = resizeShape(tri, 'se', [0.6, 0.6]);
    expect(polygonBounds(big)).toMatchObject({ x: 0.2, y: 0.2 });
    expect(polygonBounds(big).w).toBeCloseTo(0.4);
    expect(big[2]![0]).toBeCloseTo(0.4); // apex stays centred
    const small = resizeShape(tri, 'nw', [0.4, 0.4]);
    expect(polygonBounds(small).w).toBeCloseTo(0.02); // never flipped or empty
  });

  it('region and first detection carry the shape and the operator text, no power', () => {
    const shape: DrawnShape = { id: 's1', tool: 'free', points: DEFAULT_BOX, hint: '  frigo ' };
    expect(VisionRegionSchema.parse(shapeToRegion(shape))).toMatchObject({
      id: 's1',
      hint: 'frigo',
    });
    expect(shapeToRegion({ ...shape, hint: '' }).hint).toBeUndefined();
    const d = shapeToDetection({ ...shape, hint: '' }, 'Drawn object');
    expect(d).toMatchObject({ id: 's1', label: 'Drawn object', category: 'other', manual: true });
    expect(d.outline).toMatch(/^M0\.35 0\.35L/);
    expect(JSON.stringify(d)).not.toMatch(/watt|kw/i);
  });
});

describe('magnetic lasso edges', () => {
  /** 20×20 image: left half black, right half white → one vertical edge at x ≈ 10. */
  const halfImage = () => {
    const w = 20;
    const rgba = new Uint8ClampedArray(w * w * 4);
    for (let y = 0; y < w; y++)
      for (let x = 0; x < w; x++)
        rgba.fill(x >= 10 ? 255 : 0, (y * w + x) * 4, (y * w + x) * 4 + 3);
    return buildEdgeMap(rgba, w, w);
  };

  it('snaps a nearby point onto the edge', () => {
    const map = halfImage();
    const [x, y] = snapToEdge(map, [0.42, 0.5], 0.15);
    expect(Math.abs(x * 19 - 9.5)).toBeLessThanOrEqual(1);
    expect(y).toBeCloseTo(0.5, 1);
  });

  it('no edge in reach, or a blank photo → the pointer itself', () => {
    expect(snapToEdge(halfImage(), [0.1, 0.5], 0.05)).toEqual([0.1, 0.5]);
    const blank = buildEdgeMap(new Uint8ClampedArray(10 * 10 * 4), 10, 10);
    expect(blank.max).toBe(0);
    expect(snapToEdge(blank, [0.3, 0.3])).toEqual([0.3, 0.3]);
  });
});

describe('useShapeEditor', () => {
  const ev = (x: number, y: number, target: Partial<Element> = {}) =>
    ({
      clientX: x,
      clientY: y,
      pointerId: 1,
      target: { closest: () => null, ...target },
      preventDefault: () => {},
      currentTarget: { getBoundingClientRect: () => rect, setPointerCapture: () => {} },
    }) as unknown as ReactPointerEvent<HTMLElement>;
  const onShape = (id: string) => ({
    closest: (sel: string) => (sel === '[data-shape]' ? { getAttribute: () => id } : null),
  });
  const onCorner = (corner: string) => ({
    closest: (sel: string) => (sel === '[data-corner]' ? { getAttribute: () => corner } : null),
  });
  const key = (k: string, shiftKey = false) =>
    ({ key: k, shiftKey, preventDefault: () => {} }) as KeyboardEvent<HTMLElement>;

  it('draws several boxes; each stays editable: move, resize, keyboard, remove', () => {
    const { result } = renderHook(() =>
      useShapeEditor({ maxShapes: 10, edgeMap: null, tool: 'box' })
    );
    const h = () => result.current.handlers;
    act(() => h().onPointerDown(ev(120, 60)));
    act(() => h().onPointerMove(ev(160, 80)));
    expect(result.current.draft).toHaveLength(2);
    act(() => h().onPointerUp(ev(160, 80)));
    act(() => h().onPointerDown(ev(220, 100)));
    act(() => h().onPointerUp(ev(260, 130)));
    expect(result.current.shapes).toHaveLength(2);
    const [first, second] = result.current.shapes;
    expect(result.current.activeId).toBe(second!.id);

    // Drag the first shape: it gets selected and moves by the pointer delta.
    act(() => h().onPointerDown(ev(130, 70, onShape(first!.id))));
    act(() => h().onPointerMove(ev(150, 80)));
    act(() => h().onPointerUp(ev(150, 80)));
    expect(result.current.activeId).toBe(first!.id);
    expect(polygonBounds(result.current.shapes[0]!.points).x).toBeCloseTo(0.2);

    // Corner handle resizes the selected shape.
    act(() => h().onPointerDown(ev(0, 0, onCorner('se'))));
    act(() => h().onPointerMove(ev(200, 120)));
    act(() => h().onPointerUp(ev(200, 120)));
    expect(polygonBounds(result.current.shapes[0]!.points).w).toBeCloseTo(0.3);

    act(() => h().onKeyDown(key('ArrowRight')));
    expect(polygonBounds(result.current.shapes[0]!.points).x).toBeCloseTo(0.2 + KEY_STEP);
    act(() => h().onKeyDown(key('ArrowDown', true)));
    expect(polygonBounds(result.current.shapes[0]!.points).h).toBeCloseTo(0.5 + KEY_STEP);
    act(() => result.current.setHint(first!.id, 'pompe'));
    expect(result.current.shapes[0]!.hint).toBe('pompe');
    act(() => h().onKeyDown(key('Delete')));
    expect(result.current.shapes.map((s) => s.id)).toEqual([second!.id]);
  });

  it('lasso follows edges when available; stops at maxShapes; keyboard box', () => {
    const rgba = new Uint8ClampedArray(20 * 20 * 4);
    for (let i = 0; i < 400; i++) if (i % 20 >= 10) rgba.fill(255, i * 4, i * 4 + 3);
    const edgeMap = buildEdgeMap(rgba, 20, 20);
    const { result } = renderHook(() => useShapeEditor({ maxShapes: 1, edgeMap, tool: 'lasso' }));
    act(() => result.current.handlers.onPointerDown(ev(180, 60)));
    // First point (x = 0.4) snapped to the edge near x = 0.5.
    expect(result.current.draft![0]![0]).toBeGreaterThan(0.43);
    act(() => result.current.handlers.onPointerUp(ev(180, 60)));
    act(() => result.current.addBox());
    expect(result.current.shapes).toHaveLength(1);
    expect(result.current.full).toBe(true);
  });
});

describe('DetectionCanvas draw mode (PV-T8)', () => {
  function setup(props: Partial<DetectionCanvasProps> = {}) {
    const onSendShapes = vi.fn(() => true);
    const onRemoveManual = vi.fn();
    render(
      <I18nProvider>
        <DetectionCanvas
          imageUrl="data:image/jpeg;base64,AA"
          status="ready"
          detections={[fridge]}
          selectedId={null}
          onSelect={() => {}}
          onSendShapes={onSendShapes}
          onRemoveManual={onRemoveManual}
          manualRoom={30}
          {...props}
        />
      </I18nProvider>
    );
    return { onSendShapes, onRemoveManual };
  }
  const area = () => {
    const el = screen.getByRole('application', { name: /draw around a missing object/ });
    el.getBoundingClientRect = () => ({ ...rect, right: 300, bottom: 150 }) as DOMRect;
    return el;
  };
  const drag = (el: HTMLElement, from: [number, number], to: [number, number]) => {
    fireEvent.pointerDown(el, { clientX: from[0], clientY: from[1] });
    fireEvent.pointerMove(el, { clientX: to[0], clientY: to[1] });
    fireEvent.pointerUp(el, { clientX: to[0], clientY: to[1] });
  };

  it('three tools; draw two objects, name one in free text, send both', () => {
    const { onSendShapes } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Draw missing objects' }));
    for (const name of ['Rectangle', 'Free hand', 'Magnetic lasso'])
      expect(screen.getByRole('button', { name })).toBeTruthy();
    const send = () =>
      screen.getByRole('button', { name: /^Send the object/ }) as HTMLButtonElement;
    expect(send().disabled).toBe(true);
    drag(area(), [120, 60], [180, 100]);
    drag(area(), [220, 60], [280, 120]);
    expect(screen.getByRole('button', { name: 'Send the objects (2)' })).toBeTruthy();
    const hints = screen.getAllByLabelText('What is it? (optional)');
    fireEvent.change(hints[0]!, { target: { value: 'water pump' } });
    fireEvent.click(send());
    const [shapes, fallback] = onSendShapes.mock.calls[0]! as unknown as [DrawnShape[], string];
    expect(shapes.map((s) => s.hint)).toEqual(['water pump', '']);
    expect(polygonBounds(shapes[0]!.points).x).toBeCloseTo(0.1);
    expect(fallback).toBe('Drawn object');
    // Panel closes once sent.
    expect(screen.getByRole('button', { name: 'Draw missing objects' })).toBeTruthy();
  });

  it('a drawn shape can still be edited: corner handles, remove; cancel sends nothing', () => {
    const { onSendShapes } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Draw missing objects' }));
    drag(area(), [120, 60], [180, 100]);
    const layer = area();
    expect(layer.querySelectorAll('[data-corner]')).toHaveLength(4);
    // Handles sit outside the shape (its inside stays free to drag, even on a tiny box).
    expect(layer.querySelector('[data-corner="nw"]')!.getAttribute('class')).toContain(
      '-translate-x-full -translate-y-full'
    );
    expect(layer.querySelector('[data-corner="se"]')!.getAttribute('class')).not.toContain(
      'translate'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove shape 1' }));
    expect(layer.querySelectorAll('[data-shape]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Add a box' }));
    expect(layer.querySelectorAll('[data-shape]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSendShapes).not.toHaveBeenCalled();
  });

  it('drawn objects: dashed, « Added by you », « Identifying… », removable; error note', () => {
    const drawn = shapeToDetection(
      { id: 'shape-a', tool: 'box', points: DEFAULT_BOX, hint: 'Porch light' },
      'Drawn object'
    );
    const { onRemoveManual } = setup({
      detections: [fridge, drawn],
      identifyingIds: ['shape-a'],
      identifyFailed: true,
    });
    expect(
      document.querySelector('path[data-detection="shape-a"]')!.getAttribute('stroke-dasharray')
    ).toBe('6 4');
    expect(screen.getByText('Added by you')).toBeTruthy();
    expect(screen.getByText('Identifying…')).toBeTruthy();
    expect(screen.getByText(/could not be identified/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Porch light' }));
    expect(onRemoveManual).toHaveBeenCalledWith('shape-a');
  });

  it('limit reached or still loading → no drawing', () => {
    setup({ manualRoom: 0 });
    expect(
      (screen.getByRole('button', { name: 'Draw missing objects' }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(screen.getByText(/Limit reached/)).toBeTruthy();
  });
});

describe('useVisionSession.sendShapes', () => {
  const shape: DrawnShape = { id: 'shape-1', tool: 'box', points: DEFAULT_BOX, hint: 'pompe' };

  it('shows the shape at once, sends regions, then takes the model answer and SAM outline', async () => {
    const { result } = renderHook(() => useVisionSession('data:a'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const pump = {
      id: 'x',
      label: 'Water pump',
      category: 'water_pump',
      box: { x: 0.36, y: 0.36, w: 0.28, h: 0.28 },
    };
    fetchMock.mockImplementationOnce(async () =>
      sse(
        [
          'vision_regions',
          {
            phase: 'boxes',
            results: [{ regionId: 'shape-1', detection: pump }],
            source: 'meta',
            model: 'm',
          },
        ],
        [
          'vision_regions',
          {
            phase: 'outlines',
            results: [
              { regionId: 'shape-1', detection: { ...pump, outline: 'M0.4 0.4L0.6 0.4L0.5 0.6Z' } },
            ],
            source: 'meta',
            model: 'm',
          },
        ],
        ['done', {}]
      )
    );
    act(() => {
      expect(result.current.sendShapes([shape], 'Drawn object')).toBe(true);
    });
    expect(result.current.detections[1]).toMatchObject({
      id: 'shape-1',
      label: 'pompe',
      manual: true,
    });
    expect(result.current.selectedId).toBe('shape-1');
    expect(result.current.identifyingIds).toEqual(['shape-1']);
    await waitFor(() => expect(result.current.identifyingIds).toEqual([]));
    const form = fetchMock.mock.calls[1]![1].body as FormData;
    expect(JSON.parse(form.get('regions') as string)).toEqual([
      { id: 'shape-1', points: DEFAULT_BOX, hint: 'pompe' },
    ]);
    expect(result.current.detections[1]).toMatchObject({
      id: 'shape-1',
      label: 'Water pump',
      category: 'water_pump',
      manual: true,
      outline: 'M0.4 0.4L0.6 0.4L0.5 0.6Z',
    });
    expect(result.current.identifyFailed).toBe(false);
    act(() => result.current.removeManual('shape-1'));
    expect(result.current.detections).toEqual([fridge]);
  });

  it('server failure: the drawn object stays with the operator text, error flagged', async () => {
    const { result } = renderHook(() => useVisionSession('data:a'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    fetchMock.mockImplementationOnce(async () => new Response('nope', { status: 500 }));
    act(() => {
      result.current.sendShapes([shape], 'Drawn object');
    });
    await waitFor(() => expect(result.current.identifyFailed).toBe(true));
    expect(result.current.detections[1]).toMatchObject({ label: 'pompe', category: 'other' });
    expect(result.current.identifyingIds).toEqual([]);
  });

  it('nothing to send, or no room left → false', async () => {
    const { result } = renderHook(() => useVisionSession('data:a'));
    expect(result.current.sendShapes([], 'x')).toBe(false);
    expect(result.current.manualRoom).toBe(30);
  });
});
