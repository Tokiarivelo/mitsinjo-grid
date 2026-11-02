'use client';

import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { SECTOR_IDS, type AppliancePosition, type SectorId } from '@mitsinjo/engine';
import { useTranslations } from '@/lib/i18n';
import { SECTOR_POSITIONS } from '@/features/microgrid-3d/utils/site-positions';

export interface PlaceMinimapProps {
  /** Placed spot (normalized) or null = ring default. */
  value: AppliancePosition | null;
  /** Cursor start when nothing is placed yet. */
  sector: SectorId;
  onPlace: (pos: AppliancePosition) => void;
}

/** Half-side of the square map (scene units): the terrain disc plus a margin. */
export const MINIMAP_HALF = 115;
/** Cursor step (Shift = ×5). */
export const MINIMAP_STEP = 2;

const clampMap = (v: number) => Math.min(MINIMAP_HALF - 2, Math.max(-(MINIMAP_HALF - 2), v));

/**
 * Top-down village map for free placement (PP-T4): click (or tap) sets the spot, arrow keys move
 * the cursor and Enter places. First spatial 2D projection of the village: +x right, +z down.
 */
export function PlaceMinimap({ value, sector, onPlace }: PlaceMinimapProps) {
  const t = useTranslations('features.visionInsert');
  const [bx, , bz] = SECTOR_POSITIONS[sector];
  const [cursor, setCursor] = useState<AppliancePosition>(() =>
    value ? { ...value } : { x: bx, z: bz }
  );

  const place = (pos: AppliancePosition) => {
    setCursor(pos);
    onPlace(pos);
  };

  const fromEvent = (e: MouseEvent<SVGSVGElement>): AppliancePosition => {
    const rect = e.currentTarget.getBoundingClientRect();
    const u = ((e.clientX - rect.left) / rect.width) * 2 * MINIMAP_HALF - MINIMAP_HALF;
    const v = ((e.clientY - rect.top) / rect.height) * 2 * MINIMAP_HALF - MINIMAP_HALF;
    return { x: clampMap(u), z: clampMap(v) };
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const step = MINIMAP_STEP * (e.shiftKey ? 5 : 1);
    const moves: Record<string, AppliancePosition> = {
      ArrowLeft: { x: cursor.x - step, z: cursor.z },
      ArrowRight: { x: cursor.x + step, z: cursor.z },
      ArrowUp: { x: cursor.x, z: cursor.z - step },
      ArrowDown: { x: cursor.x, z: cursor.z + step },
    };
    const next = moves[e.key];
    if (next) {
      e.preventDefault();
      setCursor({ x: clampMap(next.x), z: clampMap(next.z) });
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      place(cursor);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <svg
        viewBox={`${-MINIMAP_HALF} ${-MINIMAP_HALF} ${2 * MINIMAP_HALF} ${2 * MINIMAP_HALF}`}
        role="application"
        tabIndex={0}
        aria-label={t('minimapLabel')}
        aria-describedby="place-minimap-help"
        onClick={(e) => place(fromEvent(e))}
        onKeyDown={onKeyDown}
        className="h-auto w-full cursor-crosshair rounded-lg border border-border bg-canvas-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan"
      >
        <circle r={110} className="fill-surface-elevated stroke-border" strokeWidth={1.5} />
        {SECTOR_IDS.map((s) => {
          const [x, , z] = SECTOR_POSITIONS[s];
          return (
            <circle
              key={s}
              cx={x}
              cy={z}
              r={3.2}
              className={
                s === sector
                  ? 'fill-energy-cyan/40 stroke-energy-cyan'
                  : 'fill-text-muted/40 stroke-text-muted'
              }
              strokeWidth={1.2}
            />
          );
        })}
        {value && (
          <circle
            cx={value.x}
            cy={value.z}
            r={2.6}
            className="fill-energy-cyan stroke-slate-950"
            strokeWidth={1}
          />
        )}
        <g
          className="stroke-energy-cyan"
          strokeWidth={1.4}
          aria-hidden="true"
          transform={`translate(${cursor.x} ${cursor.z})`}
        >
          <line x1={-6} y1={0} x2={6} y2={0} />
          <line x1={0} y1={-6} x2={0} y2={6} />
          <circle r={3.4} fill="none" />
        </g>
      </svg>
      <p id="place-minimap-help" className="text-[11px] text-text-muted">
        {t('minimapHelp')}
      </p>
      <p aria-live="polite" className="sr-only">
        {t('cursorAt', { x: cursor.x.toFixed(1), z: cursor.z.toFixed(1) })}
      </p>
    </div>
  );
}
