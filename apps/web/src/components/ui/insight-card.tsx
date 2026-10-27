import type { ReactNode } from 'react';
import { Cpu, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from './status-badge';
import { Button } from './button';
import { useTranslations } from '@/lib/i18n';

export type InsightOrigin = 'computed' | 'ai';

export interface InsightCardProps {
  title: string;
  text: string;
  evidenceRef?: string;
  actionLabel?: string;
  onAction?: () => void;
  origin?: InsightOrigin;
  icon?: ReactNode;
  className?: string;
}

export function InsightCard({
  title,
  text,
  evidenceRef,
  actionLabel,
  onAction,
  origin = 'computed',
  icon,
  className,
}: InsightCardProps) {
  const tCommon = useTranslations('common');

  const isAi = origin === 'ai';

  return (
    <div
      className={cn(
        'relative flex flex-col justify-between p-4 rounded-card bg-surface border transition-all',
        isAi
          ? 'border-ai-violet/50 shadow-[0_0_12px_rgba(168,85,247,0.08)]'
          : 'border-border/80 shadow-sm',
        className
      )}
    >
      <div>
        {/* Top bar: Icon, Origin Badge, Evidence Ref */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'p-1.5 rounded-control-sm shrink-0',
                isAi ? 'bg-ai-violet/15 text-ai-violet' : 'bg-surface-elevated text-solar-amber'
              )}
            >
              {icon || (isAi ? <Cpu className="h-4 w-4" aria-hidden="true" /> : <Lightbulb className="h-4 w-4" aria-hidden="true" />)}
            </div>
            <StatusBadge
              variant={isAi ? 'ai' : 'simulated'}
              label={isAi ? tCommon('aiGenerated') : tCommon('simulatedData')}
              size="sm"
            />
          </div>

          {evidenceRef && (
            <span className="font-mono text-[10px] text-text-muted px-1.5 py-0.5 rounded-control-sm bg-surface-elevated border border-border">
              {evidenceRef}
            </span>
          )}
        </div>

        {/* Content */}
        <h4 className="font-display text-sm font-semibold text-text-primary tracking-tight">
          {title}
        </h4>
        <p className="mt-1 text-xs text-text-secondary leading-relaxed">
          {text}
        </p>
      </div>

      {/* Action */}
      {actionLabel && onAction && (
        <div className="mt-3 pt-2.5 border-t border-border/50 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
