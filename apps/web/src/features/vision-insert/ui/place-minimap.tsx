'use client';

import { useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { SECTOR_IDS, type AppliancePosition, type SectorId } from '@mitsinjo/engine';
import { useTranslations } from '@/lib/i18n';
import {
  isBlocked,
  KEEP_OUT_ZONES,
  POND_CENTER,
  POND_RADIUS,
  VILLAGE_PATHS,
  type KeepOutZone,
} from '@/features/microgrid-3d/utils/landscape';
import { BUS_POSITION, SECTOR_POSITIONS } from '@/features/microgrid-3d/utils/site-positions';
import { tapPoint } from '@/features/microgrid-3d/utils/tap-point';
import type { ConnectionMode } from '@/stores/placed-models.store';

export interface PlaceMinimapProps {
  /** Placed spot (normalized) or null = ring default. */
  value: AppliancePosition | null;
  /** Cursor start when nothing is placed yet. */
  sector: SectorId;
  onPlace: (pos: AppliancePosition) => void;
  /** Site zones to show and test the cursor against (PI-T3, `siteZones`); default = static village. */
  zones?: readonly KeepOutZone[];
  /** Zone of the object being placed: not drawn, never blocks itself. */
  excludeId?: string;
  /** Grid connection mode (PI-T8/PI-T9): 'branch' (default) or 'ems'. */
  connectionMode?: ConnectionMode;
}

/** Half-side of the square map (scene units): the terrain disc plus a margin. */
export const MINIMAP_HALF = 115;
/** Cursor step (Shift = ×5). */
export const MINIMAP_STEP = 2;

/** Ids of the fixed village zones (`KEEP_OUT_ZONES`). */
const STATIC_ZONE_IDS = new Set(KEEP_OUT_ZONES.map((k) => k.id));

const clampMap = (v: number) => Math.min(MINIMAP_HALF - 2, Math.max(-(MINIMAP_HALF - 2), v));

/**
 * Top-down village map for free placement (PP-T4): click (or tap) sets the spot, arrow keys move
 * the cursor and Enter places. First spatial 2D projection of the village: +x right, +z down.
 */
export function PlaceMinimap({
  value,
  sector,
  onPlace,
  zones = KEEP_OUT_ZONES,
  excludeId,
  connectionMode = 'branch',
}: PlaceMinimapProps) {
  const t = useTranslations('features.visionInsert');
  const [bx, , bz] = SECTOR_POSITIONS[sector];
  const [cursor, setCursor] = useState<AppliancePosition>(() =>
    value ? { ...value } : { x: bx, z: bz }
  );

  // Placed objects only: static zones are drawn as buildings and the pond.
  const objects = useMemo(
    () => zones.filter((k) => k.id && k.id !== excludeId && !STATIC_ZONE_IDS.has(k.id)),
    [zones, excludeId]
  );
  const blocked = isBlocked(cursor.x, cursor.z, 0, zones, excludeId);

  // Derivation cable for the placed spot (PI-T9)
  const derivation = useMemo(() => {
    if (!value) return null;
    return tapPoint(value, sector, connectionMode, { zones, excludeId });
  }, [value, sector, connectionMode, zones, excludeId]);

  const derivationPath = useMemo(() => {
    if (!derivation || !value) return null;
    const pts = derivation.waypoint
      ? [derivation.point, derivation.waypoint, [value.x, 0, value.z]]
      : [derivation.point, [value.x, 0, value.z]];
    return pts.reduce((acc, [x, , z], i) => (i === 0 ? `M ${x} ${z}` : `${acc} L ${x} ${z}`), '');
  }, [derivation, value]);

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
        {VILLAGE_PATHS.map((path, idx) => {
          const d = path.reduce(
            (acc, [x, z], i) => (i === 0 ? `M ${x} ${z}` : `${acc} L ${x} ${z}`),
            ''
          );
          return (
            <path
              key={`path-${idx}`}
              d={d}
              className="stroke-border/40"
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
        <ellipse
          cx={POND_CENTER[0]}
          cy={POND_CENTER[1]}
          rx={POND_RADIUS + 0.8}
          ry={POND_RADIUS + 0.8}
          className="fill-network-blue/25 stroke-network-blue/60"
          strokeWidth={1}
        />
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
        {/* Central Dispatch EMS Shelter (BUS_POSITION [0, 0, 1]) */}
        <g data-testid="minimap-ems">
          <rect
            x={BUS_POSITION[0] - 3.5}
            y={BUS_POSITION[2] - 3}
            width={7}
            height={6}
            rx={1}
            className="fill-energy-cyan/20 stroke-energy-cyan/70"
            strokeWidth={1}
          />
          <text
            x={BUS_POSITION[0]}
            y={BUS_POSITION[2] + 1.2}
            textAnchor="middle"
            className="text-[2.6px] font-mono fill-energy-cyan font-bold pointer-events-none select-none"
          >
            {t('minimapEms')}
          </text>
        </g>
        {objects.map((k) => (
          <g key={k.id} data-testid={`minimap-object-${k.id}`}>
            <circle
              cx={k.x}
              cy={k.z}
              r={k.r}
              className="fill-warning-amber/30 stroke-warning-amber"
              strokeWidth={1}
            />
            <circle
              cx={k.x}
              cy={k.z}
              r={1.6}
              className="fill-warning-amber stroke-slate-950"
              strokeWidth={0.6}
            />
          </g>
        ))}
        {/* Derivation cable & poles for placed object (PI-T9) */}
        {derivationPath && (
          <path
            d={derivationPath}
            data-testid="minimap-derivation"
            className="stroke-energy-cyan/90 fill-none"
            strokeWidth={1.4}
            strokeDasharray="3 2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {derivation && (
          <g data-testid="minimap-derivation-hardware">
            <circle
              cx={derivation.point[0]}
              cy={derivation.point[2]}
              r={1.6}
              data-testid="minimap-tap"
              className={
                connectionMode === 'ems'
                  ? 'fill-energy-cyan stroke-slate-950'
                  : 'fill-energy-cyan/80 stroke-border'
              }
              strokeWidth={0.8}
            />
            {derivation.poles.map(([px, pz], i) => (
              <circle
                key={`pole-${i}`}
                cx={px}
                cy={pz}
                r={1.1}
                data-testid="minimap-pole"
                className="fill-text-primary stroke-slate-950"
                strokeWidth={0.5}
              />
            ))}
            {derivation.waypoint && (
              <circle
                cx={derivation.waypoint[0]}
                cy={derivation.waypoint[2]}
                r={1.4}
                data-testid="minimap-corner-waypoint"
                className="fill-warning-amber stroke-slate-950"
                strokeWidth={0.6}
              />
            )}
          </g>
        )}
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
          className={blocked ? 'stroke-warning-amber' : 'stroke-energy-cyan'}
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
      {blocked && <p className="text-[11px] text-warning-amber">{t('minimapBlocked')}</p>}
      <p aria-live="polite" className="sr-only">
        {t('cursorAt', { x: cursor.x.toFixed(1), z: cursor.z.toFixed(1) })}
      </p>
    </div>
  );
}
