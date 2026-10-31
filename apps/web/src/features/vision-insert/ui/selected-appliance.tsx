'use client';

import { useTranslations } from '@/lib/i18n';
import type { ApplianceDetection } from '@/lib/vision';
import { categoryHint } from '../utils/labels';

/** « Selected: Fridge » line (category added only when it says more than the label). */
export function SelectedAppliance({ selected }: { selected: ApplianceDetection | null }) {
  const t = useTranslations('features.visionInsert');
  if (!selected) return <span className="text-text-muted">{t('noneSelected')}</span>;
  const hint = categoryHint(selected.label, t(`categories.${selected.category}`));
  return (
    <span className="text-text-primary">
      {hint
        ? t('selected', { label: selected.label, category: hint })
        : t('selectedPlain', { label: selected.label })}
    </span>
  );
}
