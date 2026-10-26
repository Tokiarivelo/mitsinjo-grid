'use client';

import { useTranslations } from '@/lib/i18n';
import { StatusBadge } from '@/components/ui/status-badge';

export function SimulationPage() {
  const tCommon = useTranslations('common');
  const tSim = useTranslations('features.simulation');

  return (
    <div className="p-8">
      <div className="mb-2">
        <StatusBadge variant="simulated" label={tCommon('simulatedData')} />
      </div>
      <h1 className="text-2xl font-bold font-display text-text-primary">
        {tSim('title')}
      </h1>
      <p className="mt-2 text-text-secondary text-sm">
        {tSim('description')}
      </p>
    </div>
  );
}
