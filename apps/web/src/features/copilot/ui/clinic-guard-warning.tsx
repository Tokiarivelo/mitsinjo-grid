'use client';

import { ShieldAlert } from 'lucide-react';
import type { ClinicGuardReason } from '@mitsinjo/engine';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface ClinicGuardWarningProps {
  reasons: ClinicGuardReason[];
  /** True after the first Approve click: the next click applies the change. */
  armed: boolean;
}

/** Red K6 warning of the approval dialog: why the change endangers the clinic and that it needs two clicks. */
export function ClinicGuardWarning({ reasons, armed }: ClinicGuardWarningProps) {
  const t = useTranslations('features.copilot.clinicGuard');

  return (
    <div
      role="alert"
      className={cn(
        'p-3 rounded-lg border-2 bg-critical-red/10 text-text-primary flex gap-2.5',
        armed ? 'border-critical-red' : 'border-critical-red/50'
      )}
    >
      <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-critical-red" aria-hidden="true" />
      <div className="flex flex-col gap-1.5 min-w-0">
        <span className="font-display text-xs font-semibold uppercase tracking-wide text-critical-red">
          {t('title')}
        </span>
        <ul className="list-disc pl-4 space-y-0.5 leading-relaxed">
          {reasons.map((reason) => (
            <li key={reason}>{t(`reasons.${reason}`)}</li>
          ))}
        </ul>
        <p className="font-medium">{armed ? t('armed') : t('secondConfirm')}</p>
      </div>
    </div>
  );
}
