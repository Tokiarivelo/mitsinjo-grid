'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';

/** Loading state of the 3D scene: lazy chunk loading, or the canvas rebuilding after a lost context. */
export function VillageScenePlaceholder({ className }: { className?: string }) {
  const t = useTranslations('features.simulation');
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center w-full h-full min-h-[360px] bg-canvas-sunken text-text-muted gap-2',
        className
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-energy-cyan" aria-hidden="true" />
      <span className="text-xs font-mono tracking-wider uppercase text-text-secondary">
        {t('loading3d')}
      </span>
    </div>
  );
}
