import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface GlassPanelProps {
  children: ReactNode;
  /** Outer box (position, size). */
  className?: string;
  /** The glass surface itself (layout of the content). */
  innerClassName?: string;
  /** Soft violet / cyan light under the glass. */
  glow?: boolean;
}

/**
 * Frosted glass surface for overlays on the full-screen village (copilot terminal, controls).
 * Do not nest `position: fixed` dialogs inside: the blur makes the glass their containing block.
 */
export function GlassPanel({ children, className, innerClassName, glow = true }: GlassPanelProps) {
  return (
    <div className={cn('relative isolate', className)}>
      {glow && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-ai-violet/35 via-energy-cyan/15 to-transparent blur-3xl"
        />
      )}
      <div
        className={cn(
          'relative h-full overflow-hidden rounded-[28px] border border-border/50 bg-surface/40 backdrop-blur-2xl backdrop-saturate-150 shadow-glass-glow',
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
