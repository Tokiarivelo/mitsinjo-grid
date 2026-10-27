'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { BatteryCharging, Factory, HeartPulse, Play, Sun, Zap } from 'lucide-react';
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
import { Button, buttonVariants } from '@/components/ui/button';
import { MetricCard } from '@/components/ui/metric-card';
import { EnergyBar } from '@/components/ui/energy-bar';
import { ChartCard } from '@/components/ui/chart-card';
import { StatusBadge } from '@/components/ui/status-badge';
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
  const isRunning = useSimulationStore(selectIsRunning);
  const hasResults = useSimulationStore(selectHasResults);
  const result = useSimulationStore(selectActiveResult);
  const metrics = useSimulationStore(selectActiveMetrics);
  const steps = useSimulationStore(selectActiveSteps);
  const warnings = useSimulationStore(selectActiveWarnings);
  const timeIndex = useSimulationStore(selectTimeIndex);

  const runSimulation = useSimulationStore((s) => s.run);

  // Peak of the engine's hourly solar output (selection only, no energy math)
  const peakSolarKw = useMemo(
    () => (steps.length > 0 ? Math.max(...steps.map((s) => s.solarKw)) : null),
    [steps]
  );

  const scenarioName = tScenarios(`${scenarioId}.name` as const);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Top bar: Simulated Badge & Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <StatusBadge variant="simulated" label={tCommon('simulatedData')} />
            <span className="text-xs font-mono text-text-muted">{scenarioName}</span>
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
            <Link href="/simulation" className={buttonVariants({ variant: 'primary', size: 'md' })}>
              <Zap className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{tOverview('openLive')}</span>
            </Link>
          )}
        </div>
      </div>

      {/* 1. Four Metric Cards */}
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

      {/* 2. Middle Row: 2D Grid Schematic Preview + 24h Energy Balance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GridSchematicPreview result={result} input={input} hour={timeIndex} />
        </div>

        {/* 24h Energy Balance Card */}
        <div className="p-5 rounded-card bg-surface border border-border shadow-sm flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-border/60">
              <h3 className="font-display text-sm font-semibold text-text-primary tracking-tight">
                {tOverview('energyBalanceTitle')}
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">{tOverview('energyBalanceDesc')}</p>
            </div>

            <div className="mt-4 flex flex-col gap-3 font-mono text-xs">
              <div className="flex items-center justify-between py-2 border-b border-border/40">
                <span className="text-text-secondary flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-solar-amber" />
                  {tOverview('solarGen')}:
                </span>
                <span className="font-semibold text-solar-amber">
                  {fmtKwh(hasResults ? metrics?.solarKwh : null)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border/40">
                <span className="text-text-secondary flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-battery-green" />
                  {tOverview('batteryNet')}:
                </span>
                <span className="font-semibold text-text-primary">
                  {hasResults && metrics
                    ? `${fmtPct(metrics.socStartPct, 0)} → ${fmtPct(metrics.socEndPct, 0)}`
                    : fmtPct(null)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border/40">
                <span className="text-text-secondary flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-energy-cyan" />
                  {tOverview('servedEnergy')}:
                </span>
                <span className="font-semibold text-battery-green">
                  {fmtKwh(hasResults ? metrics?.servedKwh : null)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-text-secondary flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-critical-red" />
                  {tOverview('unservedTotal')}:
                </span>
                <span
                  className={
                    metrics && metrics.unservedKwh > 0.05
                      ? 'font-semibold text-critical-red'
                      : 'font-semibold text-text-muted'
                  }
                >
                  {fmtKwh(hasResults ? metrics?.unservedKwh : null)}
                </span>
              </div>
            </div>
          </div>

          {!hasResults && (
            <div className="mt-4 pt-3 border-t border-border/60">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => runSimulation()}
              >
                {tOverview('runSimulation')}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Bottom Row: ChartCard + Service Allocation + Impact & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Energy Over Time Chart */}
        <div className="lg:col-span-2">
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

        {/* Right Column: Service Allocation & Scenario Impact */}
        <div className="flex flex-col gap-6">
          {/* Service Allocation Card */}
          <div className="p-5 rounded-card bg-surface border border-border shadow-sm flex flex-col justify-between">
            <div className="pb-3 border-b border-border/60">
              <h3 className="font-display text-sm font-semibold text-text-primary tracking-tight">
                {tOverview('serviceAllocationTitle')}
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                {tOverview('serviceAllocationDesc')}
              </p>
            </div>

            <div className="mt-4 flex flex-col divide-y divide-border/40">
              <EnergyBar
                label={tSectors('health')}
                valuePct={hasResults && metrics ? (metrics.perSector.health?.coveragePct ?? 0) : 0}
                servedKwh={metrics?.perSector.health?.servedKwh}
                demandKwh={metrics?.perSector.health?.demandKwh}
                priority="critical"
              />
              <EnergyBar
                label={tSectors('water')}
                valuePct={hasResults && metrics ? (metrics.perSector.water?.coveragePct ?? 0) : 0}
                servedKwh={metrics?.perSector.water?.servedKwh}
                demandKwh={metrics?.perSector.water?.demandKwh}
                priority="critical"
              />
              <EnergyBar
                label={tSectors('school')}
                valuePct={hasResults && metrics ? (metrics.perSector.school?.coveragePct ?? 0) : 0}
                servedKwh={metrics?.perSector.school?.servedKwh}
                demandKwh={metrics?.perSector.school?.demandKwh}
                priority="medium"
              />
              <EnergyBar
                label={tSectors('households')}
                valuePct={
                  hasResults && metrics ? (metrics.perSector.households?.coveragePct ?? 0) : 0
                }
                servedKwh={metrics?.perSector.households?.servedKwh}
                demandKwh={metrics?.perSector.households?.demandKwh}
                priority="low"
              />
              <EnergyBar
                label={tSectors('market')}
                valuePct={hasResults && metrics ? (metrics.perSector.market?.coveragePct ?? 0) : 0}
                servedKwh={metrics?.perSector.market?.servedKwh}
                demandKwh={metrics?.perSector.market?.demandKwh}
                priority="low"
              />
            </div>
          </div>

          {/* Scenario Impact & Alerts */}
          <div className="p-5 rounded-card bg-surface border border-border shadow-sm flex flex-col gap-3">
            <div className="pb-3 border-b border-border/60">
              <h3 className="font-display text-sm font-semibold text-text-primary tracking-tight">
                {tOverview('scenarioImpactTitle')}
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                {tOverview('scenarioImpactDesc')}
              </p>
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
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-text-muted">
                {tOverview('emptyDesc')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
