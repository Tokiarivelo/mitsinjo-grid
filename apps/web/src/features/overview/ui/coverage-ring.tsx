import { fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';

export type RingTone = 'safe' | 'critical';

export interface CoverageRingProps {
  /** Engine coverage, 0–100. */
  pct: number;
  tone: RingTone;
  /** Accessible name (e.g. "Essential coverage: Proportional Allocation"). */
  label: string;
  /** Small text under the number. */
  caption: string;
  className?: string;
}

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const toneStyles: Record<RingTone, { arc: string; glow: string; text: string }> = {
  safe: { arc: 'text-battery-green', glow: 'bg-battery-green/20', text: 'text-battery-green' },
  critical: { arc: 'text-critical-red', glow: 'bg-critical-red/20', text: 'text-critical-red' },
};

/** Big circular gauge of a 0–100 engine value; the arc fills on mount (motion-safe). */
export function CoverageRing({ pct, tone, label, caption, className }: CoverageRingProps) {
  const clamped = Math.min(100, Math.max(0, pct));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);
  const s = toneStyles[tone];
  const shown = fmtNum(clamped, clamped >= 99.95 ? 0 : 1);

  return (
    <div
      role="img"
      aria-label={`${label}: ${shown} %`}
      className={cn('relative isolate aspect-square w-full max-w-44', className)}
    >
      <div
        aria-hidden="true"
        className={cn('absolute inset-4 -z-10 rounded-full blur-2xl', s.glow)}
      />
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          className="stroke-border/60"
        />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className={cn(
            s.arc,
            'motion-safe:transition-[stroke-dashoffset] motion-safe:duration-1000'
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={cn('font-display text-xl sm:text-4xl font-bold tabular-nums', s.text)}>
          {shown}
          <span className="text-xs sm:text-lg">%</span>
        </span>
        <span className="mt-0.5 hidden sm:block max-w-24 text-[11px] leading-tight text-text-secondary">
          {caption}
        </span>
      </div>
    </div>
  );
}
