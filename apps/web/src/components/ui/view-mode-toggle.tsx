import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ViewModeOption<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
}

export interface ViewModeToggleProps<T extends string> {
  options: ViewModeOption<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Accessible name of the group (translated by the caller). */
  label: string;
  /** `md`: larger touch targets (≥ 44 px on mobile), options share the width. */
  size?: 'sm' | 'md';
  className?: string;
}

/** Compact segmented control (3D / 2D / circuit, quality tiers, camera presets…). */
export function ViewModeToggle<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'sm',
  className,
}: ViewModeToggleProps<T>) {
  const md = size === 'md';
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex items-center gap-0.5 p-0.5 rounded-control bg-surface-elevated/90 backdrop-blur border border-border',
        md && 'p-1 gap-1',
        className
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          aria-pressed={value === opt.id}
          className={cn(
            'px-2 py-0.5 rounded-control-sm text-xs font-sans whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1',
            md && 'flex-1 justify-center gap-1.5 min-h-11 sm:min-h-9 px-3.5 text-sm',
            value === opt.id
              ? cn(
                  'bg-energy-cyan/20 text-energy-cyan font-medium',
                  md && 'bg-energy-cyan text-slate-950 font-semibold shadow-sm'
                )
              : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
          )}
        >
          {opt.icon}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
