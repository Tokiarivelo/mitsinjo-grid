import { Scale } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { fmtKwh } from '@/lib/format';
import type { CopilotCouncil } from '../types';

export interface CouncilBubblesProps {
  council: CopilotCouncil;
}

const signedKwh = (v: number) => (v > 0 ? `+${fmtKwh(v)}` : fmtKwh(v));

/**
 * Sector council run (M7-T1): one bubble per voice with its engine-number badges
 * (own served delta, unserved after), the picked voice highlighted, mediator verdict last.
 */
export function CouncilBubbles({ council }: CouncilBubblesProps) {
  const t = useTranslations('features.copilot');
  const tSectors = useTranslations('sectors');

  return (
    <div className="rounded-xl border border-border/70 bg-surface/60 p-3 flex flex-col gap-2.5">
      <p className="text-[10px] font-mono font-semibold uppercase tracking-wide text-text-muted">
        {t('councilTitle')}
      </p>
      <ul className="flex flex-col gap-2">
        {council.agents.map((agent) => {
          const picked = agent.sector === council.verdict.pick;
          const own = agent.impact.sectors[agent.sector];
          return (
            <li
              key={agent.sector}
              className={
                picked
                  ? 'rounded-lg border-2 border-energy-cyan/70 bg-energy-cyan/5 px-3 py-2'
                  : 'rounded-lg border border-border/70 bg-surface-elevated/60 px-3 py-2'
              }
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-text-primary">{tSectors(agent.sector)}</p>
                {picked && (
                  <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-energy-cyan/15 text-energy-cyan border border-energy-cyan/40">
                    {t('councilPicked')}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-text-secondary">{agent.reason}</p>
              <p className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface text-text-primary border border-border/60">
                  {t('councilServed')} {signedKwh(own?.servedKwhDelta ?? 0)}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface text-text-primary border border-border/60">
                  {t('councilUnserved')} {fmtKwh(agent.impact.unservedKwhAfter)}
                </span>
              </p>
            </li>
          );
        })}
      </ul>
      <div className="rounded-lg border border-ai-violet/40 bg-ai-violet/10 px-3 py-2 flex gap-2">
        <Scale className="h-4 w-4 shrink-0 text-ai-violet mt-0.5" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wide text-ai-violet">
            {t('councilMediator')}
          </p>
          <p className="mt-0.5 text-xs text-text-primary">{council.verdict.synthesis}</p>
        </div>
      </div>
    </div>
  );
}
