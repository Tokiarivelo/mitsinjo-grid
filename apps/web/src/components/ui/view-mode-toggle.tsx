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
  className?: string;
}

/** Compact segmented control (3D / 2D / circuit, quality tiers, camera presets…). */
export function ViewModeToggle<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: ViewModeToggleProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex items-center gap-0.5 p-0.5 rounded-control bg-surface-elevated/90 backdrop-blur border border-border',
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
            value === opt.id
              ? 'bg-energy-cyan/20 text-energy-cyan font-medium'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          {opt.icon}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
