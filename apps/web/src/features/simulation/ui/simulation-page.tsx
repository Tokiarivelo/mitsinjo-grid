'use client';

import { useState } from 'react';
import {
  Activity,
  BatteryCharging,
  Check,
  Copy,
  Download,
  Factory,
  Sun,
} from 'lucide-react';
import {
  useSimulationStore,
  selectActiveMetrics,
  selectActiveResult,
  selectActiveSteps,
  selectActiveStrategy,
  selectComparison,
  selectInput,
  selectIsRunning,
  selectSelectedSector,
  selectStatus,
  selectTimeIndex,
} from '@/stores';
import { fmtKwh, fmtNum, fmtPct } from '@/lib/format';
import {
  buildExportData,
  copyToClipboard,
  downloadJsonFile,
  generateSummaryMarkdown,
} from '@/lib/export';
import { useTranslations } from '@/lib/i18n';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/ui/metric-card';
import { ChartCard } from '@/components/ui/chart-card';
import { EnergyBar } from '@/components/ui/energy-bar';
import { ImpactBanner } from '@/components/ui/impact-banner';
import { EnergyOverTimeChart } from '@/components/charts';
import { SimControlsPanel } from './sim-controls-panel';
import { TimelineScrubber } from './timeline-scrubber';
import { BuildingInspectorPanel } from './building-inspector-panel';
import { VillageViewport } from './village-viewport';

export function SimulationPage() {
  const tCommon = useTranslations('common');
  const tSim = useTranslations('features.simulation');
  const tOverview = useTranslations('overview');
  const tSectors = useTranslations('sectors');
  const tActions = useTranslations('actions');

  const input = useSimulationStore(selectInput);
  const status = useSimulationStore(selectStatus);
  const activeStrategy = useSimulationStore(selectActiveStrategy);
  const selectedSector = useSimulationStore(selectSelectedSector);
  const timeIndex = useSimulationStore(selectTimeIndex);
  const result = useSimulationStore(selectActiveResult);
  const metrics = useSimulationStore(selectActiveMetrics);
  const steps = useSimulationStore(selectActiveSteps);
  const comparison = useSimulationStore(selectComparison);
  const isRunning = useSimulationStore(selectIsRunning);

  const patchInput = useSimulationStore((s) => s.patchInput);
  const runSimulation = useSimulationStore((s) => s.run);
  const resetScenario = useSimulationStore((s) => s.reset);
  const selectStrategy = useSimulationStore((s) => s.selectStrategy);
  const selectSector = useSimulationStore((s) => s.selectSector);
  const setTimeIndex = useSimulationStore((s) => s.setTimeIndex);

  const [copied, setCopied] = useState(false);

  const hasResults = status === 'complete' && Boolean(result);
  const stepAtTime = steps[timeIndex] ?? null;

  // Peak solar computed from input
  const peakSolarKw = input.solar.peakKw;

  const handleCopySummary = async () => {
    const md = generateSummaryMarkdown(input, result, comparison, activeStrategy);
    const success = await copyToClipboard(md);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadJson = () => {
    const exportData = buildExportData(input, result, comparison, activeStrategy);
    const filename = `mitsinjo-${input.scenarioId}-${activeStrategy}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    downloadJsonFile(filename, exportData);
  };

  const sectorsOrder = ['health', 'water', 'school', 'households', 'market'] as const;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Top Banner & Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <StatusBadge variant="simulated" label={tCommon('simulatedData')} />
            <StatusBadge
              variant={
                status === 'modified'
                  ? 'warning'
                  : status === 'complete'
                  ? 'complete'
                  : status === 'running'
                  ? 'running'
                  : 'ready'
              }
              size="sm"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-text-primary tracking-tight">
            {tSim('title')}
          </h1>
          <p className="text-text-secondary text-xs sm:text-sm mt-0.5">
            {tSim('description')}
          </p>
        </div>

        {/* Header Action Buttons: Copy Summary & Download JSON */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopySummary}
            icon={
              copied ? (
                <Check className="h-3.5 w-3.5 text-battery-green" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )
            }
            aria-label={tActions('copySummary')}
          >
            {copied ? tActions('copied') : tActions('copySummary')}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownloadJson}
            icon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
            aria-label={tActions('downloadJson')}
          >
            {tActions('downloadJson')}
          </Button>
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
          icon={<Activity className="h-4 w-4 text-critical-red" aria-hidden="true" />}
        />
      </div>

      {/* 2. Middle Row: Interactive Village Viewport (Left 65%) + Building Inspector (Right 35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 flex flex-col gap-4">
          <VillageViewport
            input={input}
            result={result}
            selectedSector={selectedSector}
            onSelectSector={selectSector}
            timeIndex={timeIndex}
          />

          {/* Timeline Scrubber Component */}
          <TimelineScrubber
            timeIndex={timeIndex}
            onTimeChange={setTimeIndex}
            stepResult={stepAtTime}
            hasResults={hasResults}
          />
        </div>

        <div className="lg:col-span-4">
          <BuildingInspectorPanel
            selectedSector={selectedSector}
            onSelectSector={selectSector}
            result={result}
            input={input}
            timeIndex={timeIndex}
          />
        </div>
      </div>

      {/* 3. SimControls Panel (Live sliders with Zod validation, run, reset, strategy selection) */}
      <SimControlsPanel
        input={input}
        activeStrategy={activeStrategy}
        status={status}
        onPatch={patchInput}
        onStrategyChange={selectStrategy}
        onRun={() => runSimulation()}
        onReset={resetScenario}
      />

      {/* 4. Analytics Row: 24h Generation vs Demand Chart + Service Allocation Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <ChartCard
            title={tOverview('chartTitle')}
            subtitle={tOverview('chartSubtitle')}
            summary={tOverview('energyOverTimeSummary')}
            empty={!hasResults}
            legend={
              <span className="text-[10px] font-mono text-text-muted px-2 py-0.5 rounded-control-sm bg-surface-elevated border border-border">
                {tSim('cursorAt', { hour: timeIndex })}
              </span>
            }
          >
            <EnergyOverTimeChart
              steps={steps}
              cursorHour={hasResults ? timeIndex : undefined}
              height={280}
            />
          </ChartCard>
        </div>

        <div className="lg:col-span-5 flex flex-col justify-between p-5 rounded-card bg-surface border border-border shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <h3 className="font-display text-sm font-semibold text-text-primary tracking-tight">
                {tOverview('serviceAllocationTitle')}
              </h3>
              <span className="text-[10px] font-mono text-text-muted">
                {tOverview('sectorsCount', { count: 5 })}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {sectorsOrder.map((sec) => {
                const secMetrics = metrics?.perSector[sec];
                const priority =
                  sec === 'health' || sec === 'water'
                    ? 'critical'
                    : sec === 'school' || sec === 'households'
                    ? 'medium'
                    : 'low';

                return (
                  <EnergyBar
                    key={sec}
                    sectorId={sec}
                    label={tSectors(sec)}
                    valuePct={hasResults && secMetrics ? secMetrics.coveragePct : 0}
                    demandKwh={secMetrics?.demandKwh}
                    servedKwh={secMetrics?.servedKwh}
                    priority={priority}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Bottom Impact Alerts Banner (driven only by result.warnings) */}
      {result && result.warnings.length > 0 && (
        <ImpactBanner warnings={result.warnings} />
      )}
    </div>
  );
}
