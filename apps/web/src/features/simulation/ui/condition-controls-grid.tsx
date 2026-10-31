import { cn } from '@/lib/utils';
import { SimControl } from '@/components/ui/sim-control';
import type { ConditionControl, ConditionField } from '../hooks/use-condition-controls';

export interface ConditionControlsGridProps {
  controls: readonly ConditionControl[];
  /** Subset to render, in this order; all controls when omitted. */
  fields?: readonly ConditionField[];
  showDescriptions?: boolean;
  className?: string;
}

/** Grid of scenario condition sliders from `useConditionControls`. */
export function ConditionControlsGrid({
  controls,
  fields,
  showDescriptions = true,
  className,
}: ConditionControlsGridProps) {
  const shown = fields ? fields.flatMap((f) => controls.filter((c) => c.field === f)) : controls;

  return (
    // Columns follow the box width (container query), not the screen: the grid also lives in narrow drawers.
    <div className="@container">
      <div className={cn('grid grid-cols-1 @md:grid-cols-2 @3xl:grid-cols-3 gap-3', className)}>
        {shown.map((c) => (
          <SimControl
            key={c.field}
            label={c.label}
            value={c.value}
            unit={c.unit}
            min={c.min}
            max={c.max}
            step={c.step}
            onChange={c.onChange}
            error={c.error}
            description={showDescriptions ? c.description : undefined}
          />
        ))}
      </div>
    </div>
  );
}
