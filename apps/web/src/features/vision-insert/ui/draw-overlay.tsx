'use client';

import { polygonPath } from '@/lib/vision';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { useShapeEditor } from '../hooks/use-shape-editor';
import { CORNERS, cornerPoint, type DrawTool } from '../utils/shapes';

type Editor = ReturnType<typeof useShapeEditor>;

/**
 * Corner handles sit OUTSIDE the shape (44 px touch area pointing away from it), the visible knob
 * centred on the corner: on a small box (lamp post ≈ 20 px) the inside stays free to drag.
 */
const HANDLE_AREA: Record<(typeof CORNERS)[number], string> = {
  nw: '-translate-x-full -translate-y-full items-end justify-end cursor-nwse-resize',
  ne: '-translate-y-full items-end justify-start cursor-nesw-resize',
  sw: '-translate-x-full items-start justify-end cursor-nesw-resize',
  se: 'items-start justify-start cursor-nwse-resize',
};
const HANDLE_KNOB: Record<(typeof CORNERS)[number], string> = {
  nw: 'translate-x-1/2 translate-y-1/2',
  ne: '-translate-x-1/2 translate-y-1/2',
  sw: 'translate-x-1/2 -translate-y-1/2',
  se: '-translate-x-1/2 -translate-y-1/2',
};

/**
 * Drawing layer on the photo (PV-T8): drawn shapes (amber, dashed), the stroke in progress, and
 * 4 corner handles (44 px touch area, outside the shape) on the selected shape. Pointer and keyboard go
 * to the editor.
 */
export function DrawOverlay({
  editor,
  tool,
  passThrough,
}: {
  editor: Editor;
  tool: DrawTool;
  /** « Move the photo » mode: pointers reach the scroll box (pan), not the shapes. */
  passThrough?: boolean;
}) {
  const t = useTranslations('features.visionInsert');
  const active = editor.shapes.find((s) => s.id === editor.activeId) ?? null;

  return (
    <div
      role="application"
      aria-label={t('drawArea')}
      tabIndex={0}
      className={cn(
        'absolute inset-0 touch-none bg-canvas/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-energy-cyan',
        editor.full ? 'cursor-default' : 'cursor-crosshair',
        passThrough && 'pointer-events-none'
      )}
      {...editor.handlers}
    >
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {editor.shapes.map((s) => {
          const on = s.id === editor.activeId;
          return (
            <path
              key={s.id}
              data-shape={s.id}
              d={polygonPath(s.points)}
              vectorEffect="non-scaling-stroke"
              strokeWidth={on ? 3 : 2}
              strokeDasharray="6 4"
              className={cn(
                'cursor-move stroke-solar-amber',
                on ? 'fill-solar-amber/25' : 'fill-solar-amber/10'
              )}
            />
          );
        })}
        {editor.draft && editor.draft.length > 1 && (
          <path
            d={
              tool === 'box'
                ? polygonPath([
                    editor.draft[0]!,
                    [editor.draft[1]![0], editor.draft[0]![1]],
                    editor.draft[1]!,
                    [editor.draft[0]![0], editor.draft[1]![1]],
                  ])
                : `M${editor.draft.map(([x, y]) => `${x} ${y}`).join('L')}`
            }
            vectorEffect="non-scaling-stroke"
            strokeWidth={2}
            strokeDasharray="4 3"
            className="pointer-events-none fill-solar-amber/10 stroke-solar-amber"
          />
        )}
      </svg>
      {active &&
        CORNERS.map((corner) => {
          const [x, y] = cornerPoint(active.points, corner);
          return (
            <span
              key={corner}
              data-corner={corner}
              aria-hidden="true"
              className={cn('absolute flex h-11 w-11', HANDLE_AREA[corner])}
              style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
            >
              <span
                className={cn(
                  'pointer-events-none h-3.5 w-3.5 rounded-sm border-2 border-solar-amber bg-surface',
                  HANDLE_KNOB[corner]
                )}
              />
            </span>
          );
        })}
    </div>
  );
}
