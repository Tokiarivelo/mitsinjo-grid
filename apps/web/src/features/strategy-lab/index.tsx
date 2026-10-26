'use client';

import { useTranslations } from '@/lib/i18n';
import { StatusBadge } from '@/components/ui/status-badge';

export function StrategyLabPage() {
  const tCommon = useTranslations('common');
  const tStrategy = useTranslations('features.strategyLab');

  return (
    <div className="p-8">
      <div className="mb-2">
        <StatusBadge variant="simulated" label={tCommon('simulatedData')} />
      </div>
      <h1 className="text-2xl font-bold font-display text-text-primary">
        {tStrategy('title')}
      </h1>
      <p className="mt-2 text-text-secondary text-sm">
        {tStrategy('description')}
      </p>
    </div>
  );
}
