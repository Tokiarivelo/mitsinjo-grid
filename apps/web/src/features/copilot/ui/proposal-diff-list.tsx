import { ArrowRight } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ProposalDiffItem } from '../types';

export interface ProposalDiffListProps {
  items: ProposalDiffItem[];
  /** `muted`: past decision (no highlight on the proposed value). */
  tone?: 'active' | 'muted';
  /** Per-line approval (K3): a checkbox on each row; unchecked rows are dimmed. */
  selection?: {
    isChecked: (id: string | undefined) => boolean;
    toggle: (id: string) => void;
  };
  className?: string;
}

/** "Setting: current → proposed" rows; one column in a narrow card, more when the card is wide. */
export function ProposalDiffList({
  items,
  tone = 'active',
  selection,
  className,
}: ProposalDiffListProps) {
  const t = useTranslations('features.copilot');
  if (items.length === 0) return null;
  return (
    <ul
      className={cn('grid grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3 gap-2 font-mono', className)}
    >
      {items.map((item) => {
        const id = item.id;
        const checked = selection ? selection.isChecked(id) : true;
        const highlighted = tone === 'active' && checked;
        const body = (
          <>
            <span className="text-[10px] text-text-muted uppercase break-words">{item.label}</span>
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="line-through text-text-muted">{item.current}</span>
              <ArrowRight
                className={cn(
                  'h-3 w-3 shrink-0',
                  highlighted ? 'text-energy-cyan' : 'text-text-muted'
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  'font-semibold px-1.5 py-0.5 rounded border',
                  highlighted
                    ? 'bg-energy-cyan/10 border-energy-cyan/30 text-energy-cyan'
                    : 'bg-surface-elevated border-border text-text-primary'
                )}
              >
                {item.proposed}
              </span>
            </div>
          </>
        );
        return (
          <li
            key={id ?? `${item.label}-${item.proposed}`}
            className={cn(
              'rounded-lg bg-surface border min-w-0',
              selection && !checked ? 'border-border/40 opacity-60' : 'border-border/40'
            )}
          >
            {selection && id ? (
              <label className="p-2.5 min-h-11 flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => selection.toggle(id)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-energy-cyan cursor-pointer"
                  aria-label={t('proposalLineToggle', { label: item.label })}
                />
                <span className="flex flex-col gap-1.5 min-w-0">{body}</span>
              </label>
            ) : (
              <div className="p-2.5 flex flex-col gap-1.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Lines the operator unchecked (K3): listed, dimmed, under a "Not applied" title. Nothing when empty. */
export function ProposalSkippedList({ items }: { items?: ProposalDiffItem[] }) {
  const t = useTranslations('features.copilot');
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-mono text-text-muted uppercase">
        {t('proposalSkippedTitle')}
      </span>
      <ProposalDiffList items={items} tone="muted" className="opacity-60" />
    </div>
  );
}
