import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProposalDiffItem } from '../types';

export interface ProposalDiffListProps {
  items: ProposalDiffItem[];
  /** `muted`: past decision (no highlight on the proposed value). */
  tone?: 'active' | 'muted';
  className?: string;
}

/** "Setting: current → proposed" rows; one column in a narrow card, more when the card is wide. */
export function ProposalDiffList({ items, tone = 'active', className }: ProposalDiffListProps) {
  if (items.length === 0) return null;
  return (
    <ul
      className={cn('grid grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3 gap-2 font-mono', className)}
    >
      {items.map((item) => (
        <li
          key={`${item.label}-${item.proposed}`}
          className="p-2.5 rounded-lg bg-surface border border-border/40 flex flex-col gap-1.5 min-w-0"
        >
          <span className="text-[10px] text-text-muted uppercase break-words">{item.label}</span>
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="line-through text-text-muted">{item.current}</span>
            <ArrowRight className="h-3 w-3 text-energy-cyan shrink-0" aria-hidden="true" />
            <span
              className={cn(
                'font-semibold px-1.5 py-0.5 rounded border',
                tone === 'active'
                  ? 'bg-energy-cyan/10 border-energy-cyan/30 text-energy-cyan'
                  : 'bg-surface-elevated border-border text-text-primary'
              )}
            >
              {item.proposed}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
