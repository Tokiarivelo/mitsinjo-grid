'use client';

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToolActivityProps {
  label: string;
  className?: string;
}

export function ToolActivity({ label, className }: ToolActivityProps) {
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
        <span className="text-text-primary text-xs font-medium font-sans">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-text-muted">
        <span className="px-1.5 py-0.5 rounded bg-surface border border-border">
          DETERMINISTIC
        </span>
      </div>
    </div>
  );
}
