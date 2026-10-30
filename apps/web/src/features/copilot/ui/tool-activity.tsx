'use client';

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KNOWN_SECTORS } from '../utils/format-telemetry-channel';
import { useTranslations } from '@/lib/i18n';
import type { CopilotActivity } from '../types';

const KNOWN_TOOLS = new Set([
  'start',
  'get_grid_state',
  'run_scenario',
  'compare_strategies',
  'get_sector_metrics',
  'propose_change',
  'segment_image',
  'generate_image',
  'escalate_deep_reasoning',
  'compact_history',
]);

export interface ToolActivityProps {
  activity: CopilotActivity;
  className?: string;
}

export function ToolActivity({ activity, className }: ToolActivityProps) {
  const tCopilot = useTranslations('features.copilot');
  const tSectors = useTranslations('sectors');
  const tool = KNOWN_TOOLS.has(activity.tool) ? activity.tool : 'default';
  const sector =
    activity.sector && KNOWN_SECTORS.has(activity.sector) ? tSectors(activity.sector) : '';
  const label = tCopilot(`activity.${tool}`, { sector });
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'px-4 py-2.5 rounded-lg bg-surface-container border border-ai-violet/30 flex items-center justify-between text-xs font-mono shadow-[0_0_15px_-4px_rgba(182,160,255,0.15)] animate-in fade-in duration-200',
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="w-2 h-2 rounded-full bg-ai-violet animate-pulse" />
        <Sparkles className="h-4 w-4 text-ai-violet animate-spin" aria-hidden="true" />
        <span className="text-text-primary text-xs font-medium font-sans">{label}</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-text-muted">
        <span className="px-1.5 py-0.5 rounded bg-surface border border-border">
          {tCopilot('activityBadge')}
        </span>
      </div>
    </div>
  );
}
