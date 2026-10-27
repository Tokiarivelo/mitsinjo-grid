import type { ChangeEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SimControlProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  error?: string;
  description?: string;
  kind?: 'slider' | 'input';
  className?: string;
}

export function SimControl({
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  onChange,
  error,
  description,
  kind = 'slider',
  className,
}: SimControlProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = parseFloat(e.target.value);
    if (!isNaN(next)) {
      onChange(next);
    }
  };

  const id = `control-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const descId = `${id}-desc`;
  const errorId = `${id}-error`;

  return (
    <div className={cn('flex flex-col gap-2 p-3.5 rounded-card bg-surface border border-border', className)}>
      {/* Header: Label, current value + unit */}
      <div className="flex items-center justify-between text-xs">
        <label htmlFor={id} className="font-sans font-medium text-text-primary">
          {label}
        </label>
        <span className="font-mono text-sm font-semibold text-energy-cyan bg-surface-elevated px-2 py-0.5 rounded-control-sm border border-border">
          {value} <span className="text-xs text-text-secondary font-normal">{unit}</span>
        </span>
      </div>

      {description && (
        <p id={descId} className="text-xs text-text-muted font-sans leading-relaxed">
          {description}
        </p>
      )}

      {/* Control element */}
      <div className="mt-1 flex flex-col gap-1.5">
        {kind === 'slider' ? (
          <input
            id={id}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleChange}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-valuetext={`${value} ${unit}`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : description ? descId : undefined}
            className="w-full h-2 bg-surface-elevated rounded-lg appearance-none cursor-pointer accent-solar-amber
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          />
        ) : (
          <input
            id={id}
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleChange}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : description ? descId : undefined}
            className="w-full bg-surface-elevated text-text-primary border border-border rounded-control px-3 py-1.5 text-sm font-mono
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          />
        )}

        {/* Range bounds hint */}
        <div className="flex items-center justify-between text-[11px] font-mono text-text-muted">
          <span>
            {min} {unit}
          </span>
          <span>
            {max} {unit}
          </span>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div id={errorId} role="alert" className="mt-1 flex items-center gap-1.5 text-xs text-critical-red font-sans">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
