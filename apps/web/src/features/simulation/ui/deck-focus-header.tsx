'use client';

import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp, PanelRightClose, Sliders } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface DeckFocusHeaderProps {
  /** True when the top controls are open (tabs collapsed). */
  expanded: boolean;
  /** Title shown next to the icon. */
  title: string;
  /** Extra badges after the title (status, fires). */
  badges?: ReactNode;
  onToggle: () => void;
  onClose: () => void;
}

/**
 * Deck accordion header: one toggle button (heading › button, WAI-ARIA accordion) and a sibling
 * close button, so no interactive element is nested in another.
 */
export function DeckFocusHeader({
  expanded,
  title,
  badges,
  onToggle,
  onClose,
}: DeckFocusHeaderProps) {
  const tSim = useTranslations('features.simulation');
  const tCommon = useTranslations('common');
  const toggleLabel = expanded ? tSim('collapseTopControls') : tSim('expandTopControls');
  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <div
      className={cn(
        'flex items-stretch border-b border-border shrink-0',
        expanded ? 'bg-surface-elevated/40' : 'bg-surface-elevated/50'
      )}
    >
      <h2 className="flex-1 min-w-0 flex">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          title={toggleLabel}
          className="group flex-1 min-w-0 min-h-11 flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface-elevated/80 transition-colors cursor-pointer select-none"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="p-1 rounded-md bg-energy-cyan/10 text-energy-cyan shrink-0">
              <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="text-xs font-display font-semibold uppercase tracking-wider text-text-primary group-hover:text-energy-cyan transition-colors truncate">
              {title}
            </span>
            {badges}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all shrink-0',
              expanded
                ? 'font-medium bg-surface border-border text-text-secondary group-hover:border-energy-cyan/50 group-hover:text-text-primary'
                : 'font-semibold bg-energy-cyan/15 text-energy-cyan border-energy-cyan/40 shadow-xs group-hover:bg-energy-cyan/25 group-hover:border-energy-cyan'
            )}
          >
            {!expanded && <Sliders className="h-3 w-3 shrink-0" aria-hidden="true" />}
            <span className="hidden sm:inline">{toggleLabel}</span>
            <Chevron className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </span>
        </button>
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label={tCommon('close')}
        title={tSim('hideDeck')}
        className="flex items-center justify-center w-11 shrink-0 text-text-muted hover:text-text-primary hover:bg-surface border-l border-border/60 transition-colors cursor-pointer"
      >
        <PanelRightClose className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
