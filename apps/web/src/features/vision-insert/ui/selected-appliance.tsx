'use client';

import { useTranslations } from '@/lib/i18n';
import { isAppliance, type ApplianceDetection } from '@/lib/vision';
import { useDetectionLabel, useObjectName } from '../hooks/use-object-name';
import { categoryHint } from '../utils/labels';

/** « Selected: Fridge » line (category added only when it says more than the label). */
export function SelectedAppliance({ selected }: { selected: ApplianceDetection | null }) {
  const t = useTranslations('features.visionInsert');
  const objectName = useObjectName();
  const nameOf = useDetectionLabel();
  if (!selected) return <span className="text-text-muted">{t('noneSelected')}</span>;
  const label = nameOf(selected);
  const hint = categoryHint(label, objectName(selected));
  return (
    <span className="flex flex-col gap-1">
      <span className="text-text-primary">
        {hint ? t('selected', { label, category: hint }) : t('selectedPlain', { label })}
      </span>
      {!isAppliance(selected) && (
        <span className="text-xs text-text-muted">{t('sceneryNote')}</span>
      )}
    </span>
  );
}
