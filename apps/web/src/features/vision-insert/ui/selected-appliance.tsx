'use client';

import { useTranslations } from '@/lib/i18n';
import { isAppliance, type ApplianceDetection } from '@/lib/vision';
import { useObjectName } from '../hooks/use-object-name';
import { categoryHint } from '../utils/labels';

/** « Selected: Fridge » line (category added only when it says more than the label). */
export function SelectedAppliance({ selected }: { selected: ApplianceDetection | null }) {
  const t = useTranslations('features.visionInsert');
  const objectName = useObjectName();
  if (!selected) return <span className="text-text-muted">{t('noneSelected')}</span>;
  const hint = categoryHint(selected.label, objectName(selected));
  return (
    <span className="flex flex-col gap-1">
      <span className="text-text-primary">
        {hint
          ? t('selected', { label: selected.label, category: hint })
          : t('selectedPlain', { label: selected.label })}
      </span>
      {!isAppliance(selected) && (
        <span className="text-xs text-text-muted">{t('sceneryNote')}</span>
      )}
    </span>
  );
}
