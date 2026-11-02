'use client';

import Link from 'next/link';
import { Play, Sliders } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';
import { useSimulationStore } from '@/stores';
import { cn } from '@/lib/utils';

/** Shown instead of suggested questions until a simulation has run: they are built from its result. */
export function RunSimulationCta({ className }: { className?: string }) {
  const tCopilot = useTranslations('features.copilot');
  const run = useSimulationStore((s) => s.run);

  return (
    <div
      role="group"
      aria-label={tCopilot('promptsNeedRunTitle')}
      className={cn(
        'flex flex-col items-center gap-3 p-4 rounded-card border border-dashed border-ai-violet/40 bg-surface-elevated/60',
        className
      )}
    >
      <p className="text-xs font-semibold text-text-primary">{tCopilot('promptsNeedRunTitle')}</p>
      <p className="text-xs text-text-secondary leading-relaxed">
        {tCopilot('promptsNeedRunDesc')}
      </p>
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <Button
          variant="primary"
          size="md"
          className="min-h-11"
          onClick={() => run()}
          icon={<Play className="h-4 w-4" aria-hidden="true" />}
        >
          {tCopilot('contextRunSimulation')}
        </Button>
        <Link
          href="/scenarios"
          className={buttonVariants({ variant: 'secondary', size: 'md', className: 'min-h-11' })}
        >
          <Sliders className="h-4 w-4" aria-hidden="true" />
          {tCopilot('promptsPickScenario')}
        </Link>
      </div>
    </div>
  );
}
