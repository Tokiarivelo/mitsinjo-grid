'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BatteryCharging,
  Factory,
  HeartPulse,
  Play,
  Shield,
  ShieldAlert,
  Sparkles,
  Sun,
  Zap,
} from 'lucide-react';
import { scenarios, type ScenarioId } from '@mitsinjo/engine';
import {
  selectActiveMetrics,
  selectActiveResult,
  selectActiveSteps,
  selectActiveWarnings,
  selectHasResults,
  selectInput,
  selectIsRunning,
  selectScenarioId,
  selectTimeIndex,
  useSimulationStore,
} from '@/stores';
import { fmtKwh, fmtNum, fmtPct } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { MetricCard } from '@/components/ui/metric-card';
import { EnergyBar } from '@/components/ui/energy-bar';
import { ChartCard } from '@/components/ui/chart-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { ScenarioSelector, type ScenarioOption } from '@/components/ui/scenario-selector';
import { InsightCard } from '@/components/ui/insight-card';
import { ImpactBanner } from '@/components/ui/impact-banner';
import { EnergyOverTimeChart } from '@/components/charts';
import { GridSchematicPreview } from './grid-schematic-preview';

export function OverviewPage() {
  const tCommon = useTranslations('common');
  const tOverview = useTranslations('overview');
  const tSectors = useTranslations('sectors');
  const tScenarios = useTranslations('scenarios');

  const scenarioId = useSimulationStore(selectScenarioId);
  const input = useSimulationStore(selectInput);
  const status = useSimulationStore((s) => s.status);
  const isRunning = useSimulationStore(selectIsRunning);
  const hasResults = useSimulationStore(selectHasResults);
  const result = useSimulationStore(selectActiveResult);
  const metrics = useSimulationStore(selectActiveMetrics);
  const steps = useSimulationStore(selectActiveSteps);
  const warnings = useSimulationStore(selectActiveWarnings);
  const timeIndex = useSimulationStore(selectTimeIndex);

  const runSimulation = useSimulationStore((s) => s.run);
  const loadScenario = useSimulationStore((s) => s.loadScenario);
  const setTimeIndex = useSimulationStore((s) => s.setTimeIndex);

  // Peak of the engine's hourly solar output (selection only, no energy math)
  const peakSolarKw = useMemo(
    () => (steps.length > 0 ? Math.max(...steps.map((s) => s.solarKw)) : null),
    [steps]
  );

  const scenarioOptions: ScenarioOption[] = useMemo(
    () =>
      (Object.keys(scenarios) as ScenarioId[]).map((id) => ({
        id,
        name: tScenarios(`${id}.name` as const),
        description: tScenarios(`${id}.description` as const),
      })),
    [tScenarios]
  );

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Top Executive Mission Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <StatusBadge variant="simulated" label={tCommon('simulatedData')} />
            <ScenarioSelector
              scenarios={scenarioOptions}
              value={scenarioId}
              modified={status === 'modified'}
              onChange={(id) => loadScenario(id as ScenarioId)}
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-text-primary tracking-tight">
            {tCommon('appName')}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">{tOverview('subtitle')}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!hasResults ? (
            <Button
              variant="primary"
              size="md"
              loading={isRunning}
              icon={<Play className="h-4 w-4" />}
              onClick={() => runSimulation()}
            >
              {isRunning ? tOverview('simulating') : tOverview('runSimulation')}
            </Button>
          ) : (
            <Link
              href="/simulation"
              className={buttonVariants({ variant: 'primary', size: 'md' })}
            >
              <Zap className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{tOverview('openLive')}</span>
            </Link>
          )}
        </div>
      </div>

      {/* 1. Four Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Solar PV Card */}
        <MetricCard
          variant="solar"
          label={tOverview('solarPeak')}
          value={hasResults ? fmtNum(peakSolarKw) : fmtNum(null)}
          unit="kW"
          empty={!hasResults}
          loading={isRunning}
          caption={
            hasResults && metrics
              ? tOverview('solarCaption', { kwh: fmtKwh(metrics.solarKwh) })
              : undefined
          }
          icon={<Sun className="h-4 w-4 text-solar-amber" aria-hidden="true" />}
        />

        {/* Battery SoC Card */}
        <MetricCard
          variant="battery"
          label={tOverview('batterySoc')}
          value={fmtNum(hasResults ? metrics?.socEndPct : null, 0)}
          unit="%"
          empty={!hasResults}
          loading={isRunning}
          caption={
            hasResults && metrics
              ? tOverview('batteryCaption', {
                  min: fmtPct(metrics.socMinPct, 0),
                  kwh: fmtKwh(input.battery.capacityKwh, 0),
                })
              : undefined
          }
          status={metrics && metrics.socEndPct < input.battery.minSocPct + 5 ? 'warning' : 'normal'}
          icon={<BatteryCharging className="h-4 w-4 text-battery-green" aria-hidden="true" />}
        />

        {/* Total Demand Card */}
        <MetricCard
          variant="demand"
          label={tOverview('totalDemand')}
          value={fmtNum(hasResults ? metrics?.demandKwh : null)}
          unit="kWh"
          empty={!hasResults}
          loading={isRunning}
          caption={
            hasResults && metrics
              ? tOverview('unservedEnergy', {
                  kwh: fmtKwh(metrics.unservedKwh),
                })
              : undefined
          }
          status={metrics && metrics.unservedKwh > 0.1 ? 'warning' : 'normal'}
          icon={<Factory className="h-4 w-4 text-energy-cyan" aria-hidden="true" />}
        />

        {/* Essential Services Coverage Card */}
        <MetricCard
          variant="essential"
          label={tOverview('essentialServices')}
          value={fmtNum(hasResults ? metrics?.criticalCoveragePct : null)}
          unit="%"
          empty={!hasResults}
          loading={isRunning}
          status={metrics && metrics.criticalUnservedKwh > 0.05 ? 'critical' : 'normal'}
          caption={
            hasResults && metrics
              ? metrics.criticalUnservedKwh > 0.05
                ? tOverview('criticalDeficitWarning', {
                    kwh: fmtKwh(metrics.criticalUnservedKwh),
                    hours: metrics.criticalUnmetHours,
                  })
                : tOverview('criticalProtected')
              : undefined
          }
          icon={
            <HeartPulse
              className={
                metrics && metrics.criticalUnservedKwh > 0.05
                  ? 'h-4 w-4 text-critical-red'
                  : 'h-4 w-4 text-battery-green'
              }
              aria-hidden="true"
            />
          }
        />
      </div>

      {/* 2. 2-Column Bento Command Center (12-col grid: 7 Left, 5 Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (col-span-7, ~60%): Digital Twin Preview + 24h Telemetry Chart */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Digital Twin Viewport & Docked 4-Stat Energy Balance Summary */}
          <GridSchematicPreview
            result={result}
            input={input}
            hour={timeIndex}
            onHourChange={setTimeIndex}
          />

          {/* 24h Telemetry Chart */}
          <ChartCard
            title={tOverview('energyOverTimeTitle')}
            subtitle={tOverview('energyOverTimeSubtitle')}
            unit="kW / %"
            summary={tOverview('energyOverTimeSummary')}
            empty={!hasResults}
            loading={isRunning}
          >
            {hasResults && steps.length > 0 && <EnergyOverTimeChart steps={steps} height={260} />}
          </ChartCard>
        </div>

        {/* Right Column (col-span-5, ~40%): Service Allocation & Scenario Impact */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Service Allocation & Load Shedding Hierarchy Card */}
          <div className="p-5 rounded-card bg-surface border border-border shadow-sm flex flex-col gap-4">
            <div className="pb-3 border-b border-border/60 flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-semibold text-text-primary tracking-tight">
                  {tOverview('serviceAllocationTitle')}
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  {tOverview('serviceAllocationDesc')}
                </p>
              </div>
              <Shield className="h-4 w-4 text-energy-cyan shrink-0" aria-hidden="true" />
            </div>

            {/* 5 Sectors in hierarchy order */}
            <div className="flex flex-col divide-y divide-border/40">
              {input.sectors.map((sec) => {
                const sm = metrics?.perSector[sec.id];
                return (
                  <EnergyBar
                    key={sec.id}
                    label={tSectors(sec.id)}
                    valuePct={hasResults && sm ? sm.coveragePct : 0}
                    servedKwh={sm?.servedKwh}
                    demandKwh={sm?.demandKwh}
                    priority={sec.priority}
                  />
                );
              })}
            </div>

            {/* Automated shedding protocol informative note */}
            <div className="mt-2 p-3 rounded-control bg-canvas-sunken/60 border border-border/60 text-xs font-sans text-text-secondary flex gap-2.5 items-start">
              <ShieldAlert
                className="h-4 w-4 text-energy-cyan shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="leading-relaxed">
                <span className="font-semibold text-text-primary">
                  {tOverview('sheddingProtocolTitle')}:
                </span>{' '}
                {tOverview('sheddingProtocolDesc')}
              </p>
            </div>
          </div>

          {/* Scenario Impact & Operational Insights Card */}
          <div className="p-5 rounded-card bg-surface border border-border shadow-sm flex flex-col gap-4">
            <div className="pb-3 border-b border-border/60 flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-semibold text-text-primary tracking-tight">
                  {tOverview('scenarioImpactTitle')}
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  {tOverview('scenarioImpactDesc')}
                </p>
              </div>
              <Sparkles className="h-4 w-4 text-ai-violet shrink-0" aria-hidden="true" />
            </div>

            {hasResults ? (
              <div className="flex flex-col gap-3">
                <ImpactBanner warnings={warnings} />

                {metrics && metrics.criticalUnservedKwh > 0 && (
                  <InsightCard
                    title={tOverview('criticalDeficitWarning', {
                      kwh: fmtKwh(metrics.criticalUnservedKwh),
                      hours: metrics.criticalUnmetHours,
                    })}
                    text={tOverview('clinicWarningInsight')}
                    evidenceRef="metrics.criticalUnservedKwh > 0"
                    origin="computed"
                  />
                )}

                <Link
                  href="/strategies"
                  className={cn(
                    buttonVariants({ variant: 'secondary', size: 'sm' }),
                    'w-full mt-1 justify-center'
                  )}
                >
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{tOverview('compareStrategiesCta')}</span>
                </Link>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-text-muted flex flex-col items-center gap-3">
                <p className="max-w-xs">{tOverview('emptyDesc')}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={isRunning}
                  onClick={() => runSimulation()}
                >
                  {tOverview('runSimulation')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
