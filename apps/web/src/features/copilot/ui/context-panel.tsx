'use client';

import { Cpu, Zap, BatteryCharging, ShieldAlert, SunMedium, Play } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { useSimulationStore } from '@/stores';
import { STRATEGIES, scenarios } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';

export interface ContextPanelProps {
  className?: string;
}

export function ContextPanel({ className }: ContextPanelProps) {
  const tCopilot = useTranslations('features.copilot');
  const tCommon = useTranslations('common');

  const input = useSimulationStore((s) => s.input);
  const scenarioId = useSimulationStore((s) => s.scenarioId);
  const activeStrategy = useSimulationStore((s) => s.activeStrategy);
  const results = useSimulationStore((s) => s.results);
  const runSimulation = useSimulationStore((s) => s.run);

  const activeResult = results[activeStrategy];
  const metrics = activeResult?.metrics;

  const preset = scenarios[scenarioId];
  const scenarioTitle = preset ? preset.title : scenarioId;
  const strategyInfo = STRATEGIES[activeStrategy];

  return (
    <aside
      aria-label={tCopilot('contextPanelAria')}
      className={cn('w-full xl:w-[360px] flex flex-col gap-4 shrink-0', className)}
    >
      {/* Context Panel Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-energy-cyan" aria-hidden="true" />
          <span className="text-xs font-mono font-semibold tracking-wider text-text-primary uppercase">
            {tCopilot('contextTitle')}
          </span>
        </div>
        <StatusBadge variant="simulated" label={tCommon('simulatedData')} size="sm" />
      </div>

      {/* Active Baseline Scenario Card */}
      <div className="bg-surface-elevated/80 border border-border/70 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-text-muted uppercase">
            {tCopilot('contextActiveScenario')}
          </span>
          <span className="w-2 h-2 rounded-full bg-energy-cyan" />
        </div>
        <div>
          <div className="font-display text-sm font-semibold text-text-primary">
            {scenarioTitle}
          </div>
          <div className="text-[11px] font-mono text-energy-cyan mt-0.5">
            {scenarioId.toUpperCase()}
          </div>
        </div>

        {/* Engine Specs */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40 text-center font-mono text-xs">
          <div className="p-1.5 rounded bg-surface border border-border/40">
            <div className="text-[9px] text-text-muted">{tCopilot('specPvPeak')}</div>
            <div className="text-text-primary font-medium">{input.solar.peakKw} kW</div>
          </div>
          <div className="p-1.5 rounded bg-surface border border-border/40">
            <div className="text-[9px] text-text-muted">{tCopilot('specBattery')}</div>
            <div className="text-text-primary font-medium">{input.battery.capacityKwh} kWh</div>
          </div>
          <div className="p-1.5 rounded bg-surface border border-border/40">
            <div className="text-[9px] text-text-muted">{tCopilot('specDemandMult')}</div>
            <div className="text-text-primary font-medium">{input.demandMultiplier}x</div>
          </div>
        </div>
      </div>

      {/* Dispatch Policy Indicator */}
      <div className="bg-surface-elevated/80 border border-border/70 rounded-xl p-4 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-text-muted uppercase">
            {tCopilot('contextDispatchPolicy')}
          </span>
          <span className="text-xs font-sans font-medium text-text-primary mt-0.5">
            {strategyInfo?.label || activeStrategy}
          </span>
        </div>
        <span className="px-2 py-1 rounded text-[10px] font-mono bg-surface border border-border text-energy-cyan flex items-center gap-1">
          {activeStrategy === 'essential_first'
            ? tCopilot('policyEssentialPriority')
            : tCopilot('policyProportional')}
        </span>
      </div>

      {/* Live Engine Metrics */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-text-muted uppercase tracking-wider">
          <span>{tCopilot('contextEngineMetrics')}</span>
          {activeResult && <span className="text-energy-cyan">{activeResult.id}</span>}
        </div>

        {metrics ? (
          <div className="grid grid-cols-2 gap-2.5 font-mono">
            {/* Solar Production */}
            <div className="p-3 rounded-xl bg-surface-elevated border border-border/60 flex flex-col justify-between">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[10px]">{tCopilot('metricSolarGen')}</span>
                <SunMedium className="h-3.5 w-3.5 text-energy-amber" aria-hidden="true" />
              </div>
              <div className="mt-2">
                <div className="text-sm font-bold text-energy-amber">{metrics.solarKwh} kWh</div>
                <div className="text-[10px] text-text-muted">
                  {metrics.curtailedKwh} kWh {tCopilot('curtailed')}
                </div>
              </div>
            </div>

            {/* Critical Coverage */}
            <div className="p-3 rounded-xl bg-surface-elevated border border-border/60 flex flex-col justify-between">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[10px]">{tCopilot('metricCriticalCov')}</span>
                <ShieldAlert className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
              </div>
              <div className="mt-2">
                <div className="text-sm font-bold text-secondary">
                  {metrics.criticalCoveragePct}%
                </div>
                <div className="text-[10px] text-text-muted">
                  {metrics.criticalUnservedKwh} kWh {tCopilot('unmet')}
                </div>
              </div>
            </div>

            {/* Total Energy Served */}
            <div className="p-3 rounded-xl bg-surface-elevated border border-border/60 flex flex-col justify-between">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[10px]">{tCopilot('metricServed')}</span>
                <Zap className="h-3.5 w-3.5 text-energy-cyan" aria-hidden="true" />
              </div>
              <div className="mt-2">
                <div className="text-sm font-bold text-energy-cyan">{metrics.servedKwh} kWh</div>
                <div className="text-[10px] text-text-muted">
                  {metrics.demandKwh} kWh {tCopilot('demand')}
                </div>
              </div>
            </div>

            {/* Battery End SoC */}
            <div className="p-3 rounded-xl bg-surface-elevated border border-border/60 flex flex-col justify-between">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[10px]">{tCopilot('metricBatteryMin')}</span>
                <BatteryCharging className="h-3.5 w-3.5 text-text-secondary" aria-hidden="true" />
              </div>
              <div className="mt-2">
                <div className="text-sm font-bold text-text-primary">{metrics.socMinPct}%</div>
                <div className="text-[10px] text-text-muted">
                  {tCopilot('minReserve')} {input.battery.minSocPct}%
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-surface-elevated/50 border border-border text-center flex flex-col items-center gap-2">
            <span className="text-xs text-text-secondary font-sans">
              {tCopilot('contextNoResultsPrompt')}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => runSimulation()}
              icon={<Play className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              {tCopilot('contextRunSimulation')}
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
