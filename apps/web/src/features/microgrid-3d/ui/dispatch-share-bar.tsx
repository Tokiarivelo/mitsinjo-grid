import type { SectorId } from '@mitsinjo/engine';
import { SectorIcon } from '@/components/ui/sector-icon';
import { cn } from '@/lib/utils';
import type { StatusColor } from '../types';
import { STATUS_BG_CLASS, STATUS_BORDER_CLASS, STATUS_TEXT_CLASS } from '../utils/scene-palette';

export interface DispatchSegment {
  id: SectorId;
  /** 0..1 share of the dispatched power (scene model, never computed here). */
  share: number;
  tone: StatusColor;
  /** Tooltip, e.g. "Health: Closed (2.0 kW)". */
  title: string;
}

/**
 * One bar split by sector: how the EMS controller shares the power it dispatches.
 * Plain HTML (no context), so it works inside drei <Html> and in the 2D diagrams.
 */
export function DispatchShareBar({
  segments,
  className,
}: {
  segments: DispatchSegment[];
  className?: string;
}) {
  const shown = segments.filter((s) => s.share > 0);
  return (
    <span
      className={cn('flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-border', className)}
      aria-hidden="true"
    >
      {shown.map((s) => (
        <span
          key={s.id}
          title={s.title}
          className={cn('h-full', STATUS_BG_CLASS[s.tone])}
          style={{ flexGrow: s.share, flexBasis: 0 }}
        />
      ))}
    </span>
  );
}

export interface FeederChipProps {
  id: SectorId;
  /** Formatted served power, e.g. "2.4 kW". */
  kwLabel: string;
  tone: StatusColor;
  /** 0..100 served / demand (scene model), or null without data. */
  coveragePct: number | null;
  title: string;
  /** `md` = 3D cable tag; `sm` = 2D diagram tag (container-sized text). */
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

/** kW leaving the controller on one feeder: icon, power, coverage gauge, state color. */
export function FeederChip({
  id,
  kwLabel,
  tone,
  coveragePct,
  title,
  size = 'md',
  showIcon = true,
  className,
}: FeederChipProps) {
  const sm = size === 'sm';
  return (
    <span
      title={title}
      role="img"
      aria-label={title}
      className={cn(
        'flex items-center whitespace-nowrap border bg-surface/90 font-mono leading-none shadow-sm',
        sm
          ? 'h-full w-full justify-center gap-[0.4cqw] rounded-full px-[0.5cqw] text-[1.3cqw]'
          : 'gap-1 rounded-full px-1.5 py-0.5 text-[10px] backdrop-blur-sm',
        STATUS_BORDER_CLASS[tone],
        className
      )}
    >
      {showIcon && <SectorIcon sector={id} className={sm ? 'h-[1.4cqw] w-[1.4cqw]' : 'h-3 w-3'} />}
      <span className={cn('font-semibold', STATUS_TEXT_CLASS[tone])}>{kwLabel}</span>
      {coveragePct !== null && (
        <span
          className={cn(
            'overflow-hidden rounded-full bg-border',
            sm ? 'h-[0.6cqw] w-[2.6cqw]' : 'h-1 w-6'
          )}
          aria-hidden="true"
        >
          <span
            className={cn('block h-full', STATUS_BG_CLASS[tone])}
            style={{ width: `${Math.max(0, Math.min(100, coveragePct))}%` }}
          />
        </span>
      )}
    </span>
  );
}
