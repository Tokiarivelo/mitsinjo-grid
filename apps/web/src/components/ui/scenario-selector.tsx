import type { ChangeEvent } from 'react';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';

export interface ScenarioOption {
  id: string;
  name: string;
  description?: string;
}

export interface ScenarioSelectorProps {
  scenarios: ScenarioOption[];
  value: string;
  modified?: boolean;
  onChange: (scenarioId: string) => void;
  className?: string;
}

export function ScenarioSelector({
  scenarios,
  value,
  modified = false,
  onChange,
  className,
}: ScenarioSelectorProps) {
  const tHeader = useTranslations('header');

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={cn('relative inline-flex items-center gap-2', className)}>
      <div className="relative inline-flex items-center">
        <Layers
          className="absolute left-2.5 h-3.5 w-3.5 text-text-muted pointer-events-none"
          aria-hidden="true"
        />
        <select
          value={value}
          onChange={handleChange}
          aria-label={tHeader('selectScenario')}
          className="h-9 pl-8 pr-8 py-1 text-xs font-sans font-medium text-text-primary bg-surface border border-border rounded-control appearance-none cursor-pointer
            hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-canvas transition-colors"
        >
          {scenarios.map((s) => (
            <option key={s.id} value={s.id} className="bg-surface text-text-primary py-1">
              {s.name}
            </option>
          ))}
        </select>
        <span className="absolute right-2.5 text-text-muted pointer-events-none text-[10px]">
          ▼
        </span>
      </div>

      {modified && (
        <span
          className="inline-flex items-center gap-1 text-[11px] font-mono text-warning-amber bg-warning-amber/10 border border-warning-amber/30 px-2 py-0.5 rounded-control-sm"
          title={tHeader('modifiedTooltip')}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-warning-amber animate-pulse motion-reduce:animate-none" />
          {tHeader('modified')}
        </span>
      )}
    </div>
  );
}
