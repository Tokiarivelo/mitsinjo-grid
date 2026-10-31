'use client';

import { useMemo } from 'react';
import { Sparkles, ArrowUpRight, Flame } from 'lucide-react';
import type { SectorId, SimulationResult, StrategyId } from '@mitsinjo/engine';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { suggestPrompts } from '../utils/suggest-prompts';

export interface SuggestedPromptsProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
  className?: string;
  result?: SimulationResult | null;
  activeStrategy?: StrategyId;
  scenarioId?: string;
  /** Sectors on fire at the shown hour: their questions come first (M2). */
  fires?: readonly SectorId[];
  /** `compact`: one horizontally scrollable line (under a running chat). */
  variant?: 'full' | 'compact';
}

export function SuggestedPrompts({
  onSelectPrompt,
  disabled = false,
  className,
  result,
  activeStrategy,
  scenarioId,
  fires,
  variant = 'full',
}: SuggestedPromptsProps) {
  const tCopilot = useTranslations('features.copilot');
  const tSectors = useTranslations('sectors');
  const tStrategies = useTranslations('strategies');

  const promptItems = useMemo(
    () => suggestPrompts({ result, activeStrategy, scenarioId, fires }),
    [result, activeStrategy, scenarioId, fires]
  );
  const incident = promptItems.some((p) => p.tone === 'incident');
  const header = incident
    ? tCopilot('suggestedIncidentHeader')
    : tCopilot('suggestedPromptsHeader');

  const compact = variant === 'compact';

  return (
    <div
      role="group"
      aria-label={header}
      className={cn(
        compact ? 'flex items-center gap-2 min-w-0' : 'flex flex-col gap-2 pt-2',
        className
      )}
    >
      <div className="text-[11px] font-mono text-text-muted flex items-center gap-1.5 uppercase tracking-wider shrink-0">
        {incident ? (
          <Flame className="h-3.5 w-3.5 text-critical-red" aria-hidden="true" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 text-ai-violet" aria-hidden="true" />
        )}
        <span className={cn(compact && 'sr-only', incident && 'text-critical-red')}>{header}</span>
      </div>
      <div
        className={cn(
          'flex gap-2',
          compact
            ? 'flex-nowrap overflow-x-auto overscroll-x-contain snap-x pb-1 -mb-1 min-w-0 [scrollbar-width:thin]'
            : 'flex-wrap'
        )}
      >
        {promptItems.map((item, idx) => {
          // Ids from the engine (health, essential_first) → localized names.
          const params = item.params && {
            ...item.params,
            ...(typeof item.params.sector === 'string' && {
              sector: tSectors(item.params.sector),
            }),
            ...(typeof item.params.strategy === 'string' && {
              strategy: tStrategies(item.params.strategy),
            }),
          };
          const promptText = tCopilot(item.key, params);
          return (
            <button
              key={`${item.key}-${idx}`}
              type="button"
              disabled={disabled}
              onClick={() => onSelectPrompt(promptText)}
              className={cn(
                'min-h-10 px-3 py-1.5 rounded-full bg-surface-elevated border border-border/60 hover:border-ai-violet/50 hover:bg-surface-elevated/90 text-text-secondary hover:text-text-primary transition-all text-xs font-sans flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-violet',
                compact && 'shrink-0 snap-start whitespace-nowrap',
                item.tone === 'incident' &&
                  'border-critical-red/50 text-text-primary hover:border-critical-red'
              )}
            >
              {item.tone === 'incident' && (
                <Flame className="h-3 w-3 text-critical-red shrink-0" aria-hidden="true" />
              )}
              <span>{promptText}</span>
              <ArrowUpRight
                className="h-3 w-3 text-text-muted group-hover:text-ai-violet transition-colors shrink-0"
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
