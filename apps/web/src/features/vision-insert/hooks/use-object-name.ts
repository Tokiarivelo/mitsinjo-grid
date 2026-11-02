'use client';

import { useCallback } from 'react';
import { useAppLocale, useTranslations } from '@/lib/i18n';
import { isAppliance, localLabel, type ApplianceDetection } from '@/lib/vision';

/** Localized kind of a detection: appliance category, or scenery type (house, car…). */
export function useObjectName() {
  const t = useTranslations('features.visionInsert');
  return useCallback(
    (d: Pick<ApplianceDetection, 'kind' | 'category' | 'scenery'>) =>
      isAppliance(d) ? t(`categories.${d.category}`) : t(`scenery.${d.scenery ?? 'other'}`),
    [t]
  );
}

/** Name of a detection in the page language (model translation when given, else its label). */
export function useDetectionLabel() {
  const { locale } = useAppLocale();
  return useCallback(
    (d: Pick<ApplianceDetection, 'label' | 'labels'>) => localLabel(d, locale),
    [locale]
  );
}
