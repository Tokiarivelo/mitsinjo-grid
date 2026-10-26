import type { ReactNode } from 'react';
import { AlertCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  tone?: 'neutral' | 'error';
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  tone = 'neutral',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 rounded-card border border-dashed text-center max-w-md mx-auto',
        tone === 'error'
          ? 'bg-critical-red/5 border-critical-red/30'
          : 'bg-surface/50 border-border',
        className
      )}
    >
      <div
        className={cn(
          'p-3 rounded-full mb-3',
          tone === 'error'
            ? 'bg-critical-red/15 text-critical-red'
            : 'bg-surface-elevated text-text-muted'
        )}
      >
        {icon ||
          (tone === 'error' ? (
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          ) : (
            <HelpCircle className="h-6 w-6" aria-hidden="true" />
          ))}
      </div>

      <h3 className="font-display text-base font-semibold text-text-primary tracking-tight">
        {title}
      </h3>
      <p className="mt-1 text-xs text-text-secondary leading-relaxed max-w-xs">{description}</p>

      {actionLabel && onAction && (
        <div className="mt-4">
          <Button
            variant={tone === 'error' ? 'danger' : 'primary'}
            size="sm"
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
