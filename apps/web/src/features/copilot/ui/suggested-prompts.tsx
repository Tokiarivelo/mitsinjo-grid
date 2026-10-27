'use client';

import { useMemo } from 'react';
import { Sparkles, ArrowUpRight } from 'lucide-react';
import type { SimulationResult, StrategyId } from '@mitsinjo/engine';
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
}

export function SuggestedPrompts({
  onSelectPrompt,
  disabled = false,
  className,
  result,
  activeStrategy,
  scenarioId,
}: SuggestedPromptsProps) {
  const tCopilot = useTranslations('features.copilot');
  const tSectors = useTranslations('sectors');
  const tStrategies = useTranslations('strategies');

  const promptItems = useMemo(
    () => suggestPrompts({ result, activeStrategy, scenarioId }),
    [result, activeStrategy, scenarioId]
  );

  return (
    <div className={cn('flex flex-col gap-2 pt-2', className)}>
      <div className="text-[11px] font-mono text-text-muted flex items-center gap-1.5 uppercase tracking-wider">
        <Sparkles className="h-3.5 w-3.5 text-ai-violet" aria-hidden="true" />
        <span>{tCopilot('suggestedPromptsHeader')}</span>
      </div>
      <div className="flex flex-wrap gap-2">
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
              className="px-3 py-1.5 rounded-full bg-surface-elevated border border-border/60 hover:border-ai-violet/50 hover:bg-surface-elevated/90 text-text-secondary hover:text-text-primary transition-all text-xs font-sans flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-violet"
            >
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
