'use client';

import { useState } from 'react';
import { APPLIANCE_CATEGORIES, type ApplianceCategory } from '@mitsinjo/engine';
import { Plus } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface ManualBoxFormProps {
  /** A box was dragged on the photo (else the object goes in the centre). */
  hasBox: boolean;
  onAdd: (category: ApplianceCategory, label: string) => void;
  onCancel: () => void;
}

const field =
  'min-h-11 w-full rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan';
const button =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-colors cursor-pointer';

/** Category + optional name for a box drawn by hand (PV-T8). No AI call, no power value. */
export function ManualBoxForm({ hasBox, onAdd, onCancel }: ManualBoxFormProps) {
  const t = useTranslations('features.visionInsert');
  const [category, setCategory] = useState<ApplianceCategory | ''>('');
  const [label, setLabel] = useState('');

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-energy-cyan/40 bg-energy-cyan/5 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (category) onAdd(category, label.trim() || t(`categories.${category}`));
      }}
    >
      <p role="status" className="text-sm text-text-secondary">
        {hasBox ? t('drawDone') : t('drawHint')}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          {t('categoryLabel')}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ApplianceCategory | '')}
            className={cn(field, 'cursor-pointer')}
          >
            <option value="">{t('categoryPlaceholder')}</option>
            {APPLIANCE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          {t('nameLabel')}
          <input
            value={label}
            maxLength={40}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={category ? t(`categories.${category}`) : ''}
            className={field}
          />
        </label>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            button,
            'border border-border bg-surface text-text-primary hover:bg-surface-hover'
          )}
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={!category}
          className={cn(
            button,
            'bg-energy-cyan text-slate-950 hover:bg-energy-cyan/90 disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('addManual')}
        </button>
      </div>
    </form>
  );
}
