'use client';

import { useId, useMemo, type ReactNode } from 'react';
import { BatteryCharging, Sun } from 'lucide-react';
import type { SectorId } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { fmtKw, fmtPct } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { SectorIcon } from '@/components/ui/sector-icon';
import type { BuildingSceneModel, SceneModel } from '../types';
import { useReducedMotion } from '../hooks/use-reduced-motion';
import {
  DIAGRAM_H,
  DIAGRAM_SECTORS,
  DIAGRAM_W,
  diagramLayout,
  type Box,
  type DiagramLayout,
  type DiagramVariant,
  type Pt,
} from '../utils/diagram-layout';
import { toSvgPath } from '../utils/flow-path';
import { STATUS_BG_CLASS, STATUS_TEXT_CLASS } from '../utils/scene-palette';
import { FlowWire, type WireState } from './flow-wire';

export interface GridDiagramProps {
  model: SceneModel;
  variant: DiagramVariant;
  selectedSector?: SectorId | null;
  onSelectSector?: (sector: SectorId | null) => void;
  className?: string;
}

function sectorWireState(b: BuildingSceneModel, active: boolean): WireState {
  if (active) return 'flow';
  return b.status === 'unserved' ? 'cut' : 'idle';
}

/**
 * 2D microgrid diagram (village plan or single-line circuit). Mirrors the 3D twin:
 * same SceneModel, glowing electrons on powered cables, red break marks on shed ones.
 * Labels live in reserved boxes of the SVG itself (foreignObject), so they scale with
 * the wires and never cover a cable or each other.
 */
export function GridDiagram({
  model,
  variant,
  selectedSector = null,
  onSelectSector,
  className,
}: GridDiagramProps) {
  const t = useTranslations('features.gridDiagram');
  const tSectors = useTranslations('sectors');
  const reduced = useReducedMotion();
  const animate = !reduced && !model.isModified;
  const glowId = useId().replace(/:/g, '');
  const glow = `url(#${glowId})`;

  const layout = useMemo(() => diagramLayout(variant), [variant]);
  const { lines, solar, battery, buildings } = model;
  const feederOn = lines.batteryToBus.active;

  const batteryState = !model.hasResult
    ? t('noData')
    : battery.isCharging
      ? t('charging', { kw: fmtKw(battery.flowKw) })
      : battery.isDischarging
        ? t('discharging', { kw: fmtKw(Math.abs(battery.flowKw)) })
        : t('idle');

  return (
    <div
      className={cn('flex flex-col gap-2 w-full h-full min-h-0', className)}
      data-variant={variant}
    >
      {/* Fit a 16:10 box (same ratio as the viewBox) in the space the parent gives. */}
      <div className="flex-1 min-h-0 w-full flex items-center justify-center [container-type:size]">
        <div
          role="group"
          aria-label={t(variant === 'circuit' ? 'circuitLabel' : 'topologyLabel')}
          className="relative aspect-[8/5] w-[min(100cqw,160cqh)] [container-type:size]"
        >
          <svg
            viewBox={`0 0 ${DIAGRAM_W} ${DIAGRAM_H}`}
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <defs>
              <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {variant === 'topology' && <TopologyGround layout={layout} />}

            {/* Bus bar under the feeders */}
            <line
              x1={layout.busBar[0][0]}
              y1={layout.busBar[0][1]}
              x2={layout.busBar[1][0]}
              y2={layout.busBar[1][1]}
              stroke="currentColor"
              strokeWidth={3.5}
              strokeLinecap="round"
              className={feederOn ? 'text-energy-cyan' : 'text-border-strong'}
              filter={feederOn ? glow : undefined}
            />

            <FlowWire
              points={layout.wires.solarToHub}
              line={lines.solarToBattery}
              state={lines.solarToBattery.active ? 'flow' : 'idle'}
              colorClass="text-solar-amber"
              animate={animate}
              glow={glow}
            />
            <FlowWire
              points={layout.wires.hubToBus}
              line={lines.batteryToBus}
              state={feederOn ? 'flow' : 'idle'}
              colorClass="text-energy-cyan"
              animate={animate}
              glow={glow}
            />
            {DIAGRAM_SECTORS.map((id) => {
              const b = buildings[id];
              const line = lines.busToSectors[id];
              const state = sectorWireState(b, line.active);
              return (
                <FlowWire
                  key={id}
                  points={layout.wires.busToSector[id]}
                  line={line}
                  state={state}
                  colorClass={STATUS_TEXT_CLASS[state === 'cut' ? 'critical-red' : b.statusColor]}
                  animate={animate}
                  glow={glow}
                />
              );
            })}

            {layout.breakers &&
              DIAGRAM_SECTORS.map((id) => {
                const on = lines.busToSectors[id].active;
                const b = buildings[id];
                return (
                  <Breaker
                    key={id}
                    at={layout.breakers![id]}
                    closed={on}
                    colorClass={
                      on
                        ? STATUS_TEXT_CLASS[b.statusColor]
                        : b.status === 'unserved'
                          ? 'text-critical-red'
                          : 'text-text-muted'
                    }
                  />
                );
              })}
          </svg>

          {/* Labels in their reserved boxes (same geometry as the SVG) */}
          <Slot box={layout.busLabel}>
            <span
              className={cn(
                'flex h-full items-center justify-center whitespace-nowrap rounded-full border bg-surface-elevated px-[0.9cqw] font-mono text-[1.5cqw] tracking-wide',
                feederOn
                  ? 'border-energy-cyan/40 text-energy-cyan'
                  : 'border-border text-text-muted'
              )}
            >
              {t('bus')} · {fmtKw(model.hasResult ? lines.batteryToBus.flowKw : null)}
            </span>
          </Slot>

          <Slot box={layout.boxes.solar}>
            <NodeCard
              tone="solar"
              icon={<Sun className="h-[2.2cqw] w-[2.2cqw] text-solar-amber" />}
            >
              <span className="block truncate text-text-secondary">{t('solar')}</span>
              <span className="block truncate font-mono font-semibold text-solar-amber">
                {fmtKw(model.hasResult ? solar.currentKw : null)}
              </span>
            </NodeCard>
          </Slot>

          <Slot box={layout.boxes.hub}>
            <NodeCard
              tone="battery"
              icon={<BatteryCharging className="h-[2.2cqw] w-[2.2cqw] text-battery-green" />}
            >
              <span className="block truncate text-text-secondary">{t('battery')}</span>
              <span className="block truncate font-mono font-semibold text-battery-green">
                {t('soc', { pct: fmtPct(battery.socPct, 0) })}
              </span>
              <span className="block truncate font-mono text-text-muted">{batteryState}</span>
            </NodeCard>
          </Slot>

          {DIAGRAM_SECTORS.map((id) => (
            <Slot key={id} box={layout.boxes.sectors[id]}>
              <SectorCard
                id={id}
                name={tSectors(id)}
                building={buildings[id]}
                hasResult={model.hasResult}
                statusLabel={t(`status.${buildings[id].status}`)}
                noLoadLabel={t('status.noLoad')}
                selected={selectedSector === id}
                onSelect={onSelectSector}
              />
            </Slot>
          ))}
        </div>
      </div>

      <DiagramLegend />
    </div>
  );
}

/**
 * HTML label over its reserved diagram box. Positions are % of the 16:10 box and
 * text uses container units (cqw), so labels scale with the wires without transforms.
 */
function Slot({ box, children }: { box: Box; children: ReactNode }) {
  return (
    <div
      className="absolute"
      style={{
        left: `${(box.x / DIAGRAM_W) * 100}%`,
        top: `${(box.y / DIAGRAM_H) * 100}%`,
        width: `${(box.w / DIAGRAM_W) * 100}%`,
        height: `${(box.h / DIAGRAM_H) * 100}%`,
      }}
    >
      {children}
    </div>
  );
}

function NodeCard({
  tone,
  icon,
  children,
}: {
  tone: 'solar' | 'battery';
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex h-full items-center gap-[0.9cqw] overflow-hidden rounded-[0.9cqw] border bg-surface px-[1.2cqw] text-[1.72cqw] leading-[1.3]',
        tone === 'solar' ? 'border-solar-amber/60' : 'border-battery-green/60'
      )}
    >
      <span className="shrink-0" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function SectorCard({
  id,
  name,
  building,
  hasResult,
  statusLabel,
  noLoadLabel,
  selected,
  onSelect,
}: {
  id: SectorId;
  name: string;
  building: BuildingSceneModel;
  hasResult: boolean;
  statusLabel: string;
  noLoadLabel: string;
  selected: boolean;
  onSelect?: (sector: SectorId | null) => void;
}) {
  // A sector with no demand this hour is not "powered": show it neutral.
  const noLoad = hasResult && building.status === 'full' && building.demandKw <= 0.05;
  const statusColor = noLoad ? 'idle' : building.statusColor;
  const className = cn(
    'flex h-full w-full flex-col justify-center overflow-hidden rounded-[0.9cqw] border bg-surface px-[1.2cqw] text-left text-[1.64cqw] leading-[1.2] transition-colors',
    selected
      ? 'border-energy-cyan ring-2 ring-energy-cyan/50'
      : building.status === 'unserved'
        ? 'border-critical-red/70'
        : 'border-border',
    onSelect && 'cursor-pointer hover:border-text-secondary'
  );
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-[0.6cqw]">
        <SectorIcon sector={id} className="h-[1.9cqw] w-[1.9cqw]" />
        <span className="truncate font-semibold text-text-primary">{name}</span>
      </span>
      <span className="truncate whitespace-nowrap font-mono">
        <span className={cn('font-semibold', STATUS_TEXT_CLASS[statusColor])}>
          {fmtKw(hasResult ? building.servedKw : null)}
        </span>
        {hasResult && <span className="text-text-muted"> / {fmtKw(building.demandKw)}</span>}
      </span>
      <span
        className={cn('flex min-w-0 items-center gap-[0.5cqw]', STATUS_TEXT_CLASS[statusColor])}
      >
        <span
          className={cn(
            'h-[0.9cqw] w-[0.9cqw] shrink-0 rounded-full',
            STATUS_BG_CLASS[statusColor]
          )}
          aria-hidden="true"
        />
        <span className="truncate">{noLoad ? noLoadLabel : statusLabel}</span>
      </span>
    </>
  );
  return onSelect ? (
    <button
      type="button"
      title={name}
      aria-pressed={selected}
      onClick={() => onSelect(selected ? null : id)}
      className={className}
    >
      {content}
    </button>
  ) : (
    <div title={name} className={className}>
      {content}
    </div>
  );
}

/** IEC-style breaker on a horizontal feeder: closed = straight bar; open = lifted blade. */
function Breaker({ at, closed, colorClass }: { at: Pt; closed: boolean; colorClass: string }) {
  const [x, y] = at;
  return (
    <g className={colorClass} stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
      <rect
        x={x - 8}
        y={y - 6}
        width={16}
        height={12}
        rx={2}
        className="fill-canvas"
        strokeWidth={0.7}
      />
      <circle cx={x - 5} cy={y} r={1.1} fill="currentColor" stroke="none" />
      <circle cx={x + 5} cy={y} r={1.1} fill="currentColor" stroke="none" />
      {closed ? (
        <line x1={x - 5} y1={y} x2={x + 5} y2={y} />
      ) : (
        <line x1={x - 5} y1={y} x2={x + 4} y2={y - 4.5} />
      )}
    </g>
  );
}

/** Village plan texture: a pale street under every cable run. */
function TopologyGround({ layout }: { layout: DiagramLayout }) {
  const runs = [
    layout.wires.solarToHub,
    layout.wires.hubToBus,
    layout.busBar,
    ...DIAGRAM_SECTORS.map((id) => layout.wires.busToSector[id]),
  ];
  return (
    <g
      className="text-border"
      stroke="currentColor"
      strokeOpacity={0.4}
      strokeWidth={8}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      {runs.map((pts, i) => (
        <path key={i} d={toSvgPath(pts)} />
      ))}
    </g>
  );
}

function DiagramLegend() {
  const t = useTranslations('features.gridDiagram');
  const items: { key: string; swatch: ReactNode }[] = [
    {
      key: 'legendFlow',
      swatch: (
        <span className="flex items-center gap-0.5" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-energy-cyan shadow-[0_0_6px_var(--color-energy-cyan)]" />
          <span className="h-1.5 w-1.5 rounded-full bg-energy-cyan shadow-[0_0_6px_var(--color-energy-cyan)]" />
        </span>
      ),
    },
    {
      key: 'legendPartial',
      swatch: <span className="h-0.5 w-4 rounded-full bg-warning-amber" aria-hidden="true" />,
    },
    {
      key: 'legendCut',
      swatch: (
        <span className="w-4 border-t border-dashed border-critical-red" aria-hidden="true" />
      ),
    },
    {
      key: 'legendIdle',
      swatch: <span className="h-0.5 w-4 rounded-full bg-border-strong" aria-hidden="true" />,
    },
  ];
  return (
    <ul
      aria-label={t('legendTitle')}
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-text-muted font-sans"
    >
      {items.map((it) => (
        <li key={it.key} className="flex items-center gap-1.5">
          {it.swatch}
          <span>{t(it.key)}</span>
        </li>
      ))}
    </ul>
  );
}
