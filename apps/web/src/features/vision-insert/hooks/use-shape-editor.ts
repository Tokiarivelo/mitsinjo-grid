'use client';

import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { snapToEdge, type EdgeMap } from '../utils/edge-map';
import {
  addStrokePoint,
  DEFAULT_BOX,
  finishStroke,
  moveShape,
  resizeShape,
  toNormPoint,
  type Corner,
  type DrawnShape,
  type DrawTool,
  type Pt,
} from '../utils/shapes';

/** Arrow-key step (fraction of the photo). */
export const KEY_STEP = 0.01;

type Gesture =
  | { mode: 'draw'; points: Pt[] }
  | { mode: 'move'; id: string; last: Pt }
  | { mode: 'resize'; id: string; corner: Corner };

export interface ShapeEditorOptions {
  /** Most shapes at once (left before the per-photo limit, and per send). */
  maxShapes: number;
  /** Edges for the magnetic lasso; null = the lasso draws freely. */
  edgeMap: EdgeMap | null;
  /** Tool for new shapes. */
  tool: DrawTool;
}

/**
 * Shapes drawn around missing objects (PV-T8), editable until sent. On the drawing layer:
 * drag on empty photo = new shape with the current tool · drag a shape = move it (and select it) ·
 * drag a corner handle (`data-corner`) = resize. Keyboard on the layer: arrows move the selected
 * shape, Shift + arrows resize it, Delete removes it.
 */
export function useShapeEditor({ maxShapes, edgeMap, tool }: ShapeEditorOptions) {
  const [shapes, setShapes] = useState<DrawnShape[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Pt[] | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const nextId = useRef(1);
  const full = shapes.length >= maxShapes;

  const update = useCallback((id: string, change: (s: DrawnShape) => DrawnShape) => {
    setShapes((list) => list.map((s) => (s.id === id ? change(s) : s)));
  }, []);

  const add = useCallback(
    (shapeTool: DrawTool, points: Pt[]) => {
      const id = `shape-${Date.now().toString(36)}-${nextId.current++}`;
      setShapes((list) =>
        list.length >= maxShapes ? list : [...list, { id, tool: shapeTool, points, hint: '' }]
      );
      setActiveId(id);
    },
    [maxShapes]
  );

  const pointOf = (e: PointerEvent<HTMLElement>) =>
    toNormPoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
  const strokePoint = (p: Pt) => (tool === 'lasso' && edgeMap ? snapToEdge(edgeMap, p) : p);

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    const p = pointOf(e);
    const target = e.target as Element;
    const corner = target.closest?.('[data-corner]')?.getAttribute('data-corner') as Corner | null;
    const shapeId = target.closest?.('[data-shape]')?.getAttribute('data-shape') ?? null;
    if (corner && activeId) gesture.current = { mode: 'resize', id: activeId, corner };
    else if (shapeId) {
      setActiveId(shapeId);
      gesture.current = { mode: 'move', id: shapeId, last: p };
    } else if (!full) {
      const first = strokePoint(p);
      gesture.current = { mode: 'draw', points: [first] };
      setDraft([first]);
    } else return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g) return;
    const p = pointOf(e);
    if (g.mode === 'draw') {
      g.points = tool === 'box' ? [g.points[0]!, p] : addStrokePoint(g.points, strokePoint(p));
      setDraft(g.points);
    } else if (g.mode === 'move') {
      const [dx, dy] = [p[0] - g.last[0], p[1] - g.last[1]];
      g.last = p;
      update(g.id, (s) => ({ ...s, points: moveShape(s.points, dx, dy) }));
    } else {
      update(g.id, (s) => ({ ...s, points: resizeShape(s.points, g.corner, p) }));
    }
  };

  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (g?.mode !== 'draw') return;
    const end = pointOf(e);
    const points =
      tool === 'box' ? [g.points[0]!, end] : addStrokePoint(g.points, strokePoint(end));
    setDraft(null);
    const shape = finishStroke(tool, points);
    if (shape) add(tool, shape);
  };

  const remove = useCallback((id: string) => {
    setShapes((list) => list.filter((s) => s.id !== id));
    setActiveId((a) => (a === id ? null : a));
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!activeId) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      remove(activeId);
      return;
    }
    const dir: Record<string, Pt> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const d = dir[e.key];
    if (!d) return;
    e.preventDefault();
    update(activeId, (s) => {
      if (!e.shiftKey) return { ...s, points: moveShape(s.points, d[0], d[1]) };
      // Shift: the bottom-right corner follows the arrow.
      const xs = s.points.map((p) => p[0]);
      const ys = s.points.map((p) => p[1]);
      return {
        ...s,
        points: resizeShape(s.points, 'se', [Math.max(...xs) + d[0], Math.max(...ys) + d[1]]),
      };
    });
  };

  return {
    shapes,
    activeId,
    draft,
    full,
    select: setActiveId,
    remove,
    setHint: useCallback(
      (id: string, hint: string) => update(id, (s) => ({ ...s, hint: hint.slice(0, 40) })),
      [update]
    ),
    /** Starts from existing shapes (box correction): replaces the list, selects the first. */
    load: useCallback((list: DrawnShape[]) => {
      setShapes(list);
      setActiveId(list[0]?.id ?? null);
      setDraft(null);
      gesture.current = null;
    }, []),
    /** Keyboard path: a centred box to move / resize with the arrows. */
    addBox: useCallback(() => add('box', DEFAULT_BOX), [add]),
    clear: useCallback(() => {
      setShapes([]);
      setActiveId(null);
      setDraft(null);
      gesture.current = null;
    }, []),
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onKeyDown,
    },
  };
}
