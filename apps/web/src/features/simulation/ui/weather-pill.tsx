'use client';

import type { WeatherId } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { WEATHER_VISUALS } from '../utils/weather';

export interface WeatherPillProps {
  weather: WeatherId;
  /** Visible text (weather name, or "Day 2"…). */
  label: string;
  selected?: boolean;
  onClick?: () => void;
  /** Use 'radio' inside a radiogroup; default is a toggle button. */
  role?: 'radio';
  ariaLabel?: string;
  title?: string;
  /** Small status dot (e.g. critical deficit that day). */
  alert?: boolean;
  className?: string;
}

/** Rounded weather chip: icon + label, ≥ 44 px touch target. */
export function WeatherPill({
  weather,
  label,
  selected = false,
  onClick,
  role,
  ariaLabel,
  title,
  alert = false,
  className,
}: WeatherPillProps) {
  const { icon: Icon, tone } = WEATHER_VISUALS[weather];
  return (
    <button
      type="button"
      role={role}
      aria-checked={role === 'radio' ? selected : undefined}
      aria-pressed={role === 'radio' ? undefined : selected}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center gap-1.5 min-h-11 px-3 rounded-full border text-xs font-sans font-medium whitespace-nowrap transition-all cursor-pointer',
        selected
          ? 'bg-energy-cyan/15 border-energy-cyan text-text-primary ring-1 ring-energy-cyan/50'
          : 'bg-surface-elevated/60 border-border text-text-secondary hover:bg-surface-hover hover:text-text-primary',
        className
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', tone)} aria-hidden="true" />
      <span>{label}</span>
      {alert && (
        <span
          className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-critical-red ring-2 ring-surface"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
