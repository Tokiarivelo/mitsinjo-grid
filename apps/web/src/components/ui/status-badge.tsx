import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Cpu, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusBadgeVariant =
  | 'ready'
  | 'running'
  | 'complete'
  | 'warning'
  | 'critical'
  | 'simulated'
  | 'ai';

export type StatusBadgeSize = 'sm' | 'md';

export interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  label?: string;
  icon?: ReactNode;
  size?: StatusBadgeSize;
  className?: string;
}

const DEFAULT_LABELS: Record<StatusBadgeVariant, string> = {
  ready: 'READY',
  running: 'SIMULATING',
  complete: 'SIMULATION COMPLETE',
  warning: 'WARNING',
  critical: 'CRITICAL',
  simulated: 'SIMULATED DATA',
  ai: 'AI-GENERATED',
};

export function StatusBadge({
  variant,
  label,
  icon,
  size = 'md',
  className,
}: StatusBadgeProps) {
  const text = label || DEFAULT_LABELS[variant];

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1 rounded-control-sm font-medium',
    md: 'text-xs px-2.5 py-1 gap-1.5 rounded-control font-medium',
  };

  const variantStyles: Record<StatusBadgeVariant, string> = {
    ready: 'bg-battery-green/12 text-battery-green border border-battery-green/30',
    running:
      'bg-energy-cyan/12 text-energy-cyan border border-energy-cyan/30 animate-pulse motion-reduce:animate-none',
    complete: 'bg-battery-green/15 text-battery-green border border-battery-green/35',
    warning: 'bg-warning-amber/12 text-warning-amber border border-warning-amber/35',
    critical: 'bg-critical-red/15 text-critical-red border border-critical-red/35',
    simulated:
      'bg-surface-elevated/80 text-text-muted border border-border font-mono text-[10px] tracking-wider uppercase',
    ai: 'bg-ai-violet/15 text-ai-violet border border-ai-violet/35 font-medium',
  };

  const defaultIcon = () => {
    switch (variant) {
      case 'ready':
        return <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />;
      case 'running':
        return <Cpu className="h-3 w-3 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />;
      case 'complete':
        return <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />;
      case 'warning':
        return <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />;
      case 'critical':
        return <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />;
      case 'ai':
        return <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />;
      case 'simulated':
        return null;
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center select-none whitespace-nowrap',
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
    >
      {icon ? (
        <span className="shrink-0" aria-hidden="true">
          {icon}
        </span>
      ) : (
        defaultIcon()
      )}
      <span className="leading-none">{text}</span>
    </span>
  );
}
