'use client';

import { useCallback } from 'react';
import { useTranslations } from '@/lib/i18n';
import { isAppliance, type ApplianceDetection } from '@/lib/vision';

/** Localized kind of a detection: appliance category, or scenery type (house, car…). */
export function useObjectName() {
  const t = useTranslations('features.visionInsert');
  return useCallback(
    (d: Pick<ApplianceDetection, 'kind' | 'category' | 'scenery'>) =>
      isAppliance(d) ? t(`categories.${d.category}`) : t(`scenery.${d.scenery ?? 'other'}`),
    [t]
  );
}
