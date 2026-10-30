'use client';

import { useMemo, useState } from 'react';
import { connectedSectorIds } from '@mitsinjo/engine';
import {
  Activity,
  BatteryCharging,
  Bot,
  Building2,
  Check,
  Copy,
  Download,
  Factory,
  PanelRightClose,
  PanelRightOpen,
  Sliders,
  Sun,
} from 'lucide-react';
import {
  useSimulationStore,
  selectActiveMetrics,
  selectActiveResult,
  selectActiveSteps,
  selectActiveStrategy,
  selectActiveWorkflowResult,
  selectDayIndex,
  selectComparison,
  selectInput,
  selectIsPlaying,
  selectIsRunning,
  selectSelectedSector,
  selectStatus,
  selectTimeIndex,
  selectWorkflow,
} from '@/stores';
import { fmtKwh, fmtNum, fmtPct } from '@/lib/format';
import {
  buildExportData,
  copyToClipboard,
  downloadJsonFile,
  generateSummaryMarkdown,
  type Translate,
} from '@/lib/export';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/ui/metric-card';
import { ChartCard } from '@/components/ui/chart-card';
import { EnergyBar } from '@/components/ui/energy-bar';
import { ImpactBanner } from '@/components/ui/impact-banner';
import { EnergyOverTimeChart } from '@/components/charts';
import { CopilotWorkspace } from '@/features/copilot';
import { SimControlsPanel } from './sim-controls-panel';
import { TimelineScrubber } from './timeline-scrubber';
import { BuildingInspectorPanel } from './building-inspector-panel';
import { SectorLoadPanel } from './sector-load-panel';
import { VillageViewport } from './village-viewport';
import { PlaybackActions } from './playback-actions';
import { WeatherWorkflowPanel } from './weather-workflow-panel';
import { HardwareLinkSection } from '@/features/hardware-link';
import { DayStrip } from './day-strip';
import { usePlaybackTicker } from '../hooks/use-playback-ticker';
import { simStatusBadgeVariant } from '../utils/playback';

export type SimulationTab = 'metrics' | 'controls' | 'buildings' | 'copilot';

const TABS: { id: SimulationTab; labelKey: string; icon: typeof Activity }[] = [
  { id: 'metrics', labelKey: 'tabMetrics', icon: Activity },
  { id: 'controls', labelKey: 'tabControls', icon: Sliders },
  { id: 'buildings', labelKey: 'tabBuildings', icon: Building2 },
  { id: 'copilot', labelKey: 'tabCopilot', icon: Bot },
];

export function SimulationPage() {
  const tCommon = useTranslations('common');
  const tSim = useTranslations('features.simulation');
  const tOverview = useTranslations('overview');
  const tSectors = useTranslations('sectors');
  const tActions = useTranslations('actions');
  const tRootRaw = useTranslations();
  const tRoot: Translate = (key, values) => tRootRaw(key as never, values as never);

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
  const isPlaying = useSimulationStore(selectIsPlaying);
  const workflow = useSimulationStore(selectWorkflow);
  const dayIndex = useSimulationStore(selectDayIndex);
  const workflowResult = useSimulationStore(selectActiveWorkflowResult);

  const patchInput = useSimulationStore((s) => s.patchInput);
  const resetScenario = useSimulationStore((s) => s.reset);
  const selectStrategy = useSimulationStore((s) => s.selectStrategy);
  const selectSector = useSimulationStore((s) => s.selectSector);
  const setTimeIndex = useSimulationStore((s) => s.setTimeIndex);
  const pauseSimulation = useSimulationStore((s) => s.pause);
  const stopSimulation = useSimulationStore((s) => s.stop);
  const restartSimulation = useSimulationStore((s) => s.restart);
  const togglePlaySimulation = useSimulationStore((s) => s.togglePlay);
  const addWorkflowDay = useSimulationStore((s) => s.addWorkflowDay);
  const removeWorkflowDay = useSimulationStore((s) => s.removeWorkflowDay);
  const setDayWeather = useSimulationStore((s) => s.setDayWeather);
  const setDayIndex = useSimulationStore((s) => s.setDayIndex);

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<SimulationTab>('metrics');
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  usePlaybackTicker(isPlaying);

  const hasResults = status === 'complete' && Boolean(result);

  const stepAtTime = steps[timeIndex] ?? null;

  // Jumping to a day takes over from playback, like scrubbing the timeline.
  const handleSelectDay = (day: number) => {
    if (isPlaying) pauseSimulation();
    setDayIndex(day);
  };

  // Peak solar computed from input
  const peakSolarKw = input.solar.peakKw;

  const handleCopySummary = async () => {
    const md = generateSummaryMarkdown(tRoot, input, result, comparison, activeStrategy);
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

  const handleSelectSector = (sec: Parameters<typeof selectSector>[0]) => {
    selectSector(sec);
    if (sec) {
      setIsPanelOpen(true);
      setActiveTab('buildings');
    }
  };

  // Connected sectors only (a disconnected one is managed in the Buildings tab).
  const sectorsOrder = useMemo(() => connectedSectorIds(input), [input]);

  return (
    <div className="flex flex-col gap-6 max-w-[1720px] w-full mx-auto">
      {/* Top Banner & Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <StatusBadge variant="simulated" label={tCommon('simulatedData')} />
            <StatusBadge variant={simStatusBadgeVariant(status, isPlaying)} size="sm" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-text-primary tracking-tight">
            {tSim('title')}
          </h1>
          <p className="text-text-secondary text-xs sm:text-sm mt-0.5">{tSim('description')}</p>
        </div>

        {/* Header Action Buttons: Run/Play/Pause/Stop/Restart, Toggle Deck, Copy Summary & Download JSON */}
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          {/* Primary simulation transport controls outside Controls tab */}
          {!(isPanelOpen && activeTab === 'controls') && (
            <PlaybackActions
              status={status}
              isPlaying={isPlaying}
              hasResults={hasResults}
              onTogglePlay={togglePlaySimulation}
              onStop={stopSimulation}
              onRestart={restartSimulation}
            />
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsPanelOpen((prev) => !prev)}
            icon={
              isPanelOpen ? (
                <PanelRightClose className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <PanelRightOpen className="h-3.5 w-3.5 text-energy-cyan" aria-hidden="true" />
              )
            }
            aria-label={isPanelOpen ? tSim('togglePanelCollapse') : tSim('togglePanelExpand')}
            title={isPanelOpen ? tSim('togglePanelCollapse') : tSim('togglePanelExpand')}
          >
            {isPanelOpen ? tSim('hideDeck') : tSim('showDeck')}
          </Button>

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

      {/* Main Split: Dominant 3D Viewport on Left (or Full Width) + Collapsible Multi-Tab Panel on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Center: Massive 3D Village Viewport + Dedicated Curseur Temporel 24h Docked Below */}
        <div
          className={cn(
            'flex flex-col gap-4 min-w-0 transition-all duration-300',
            isPanelOpen ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'
          )}
        >
          {/* 3D Digital Twin Viewport */}
          <div className="relative">
            <VillageViewport
              input={input}
              result={result}
              selectedSector={selectedSector}
              onSelectSector={handleSelectSector}
              timeIndex={timeIndex}
              isModified={status === 'modified'}
              weather={workflow[dayIndex]?.weather ?? workflow[0]?.weather}
              className="min-h-[380px] sm:min-h-[480px] lg:min-h-[640px] h-[400px] sm:h-[520px] lg:h-[640px]"
            />

            {/* Quick Floating Open Deck Button if panel is collapsed */}
            {!isPanelOpen && (
              <button
                type="button"
                onClick={() => setIsPanelOpen(true)}
                aria-label={tSim('openDeck')}
                className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-surface-elevated/95 backdrop-blur border border-energy-cyan/50 text-energy-cyan shadow-lg hover:bg-surface transition-all cursor-pointer font-sans text-xs font-medium"
              >
                <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
                <span>{tSim('openDeck')}</span>
              </button>
            )}
          </div>

          {/* Weather workflow day selector (multi-day runs only) */}
          {workflow.length > 1 && (
            <DayStrip
              workflow={workflow}
              dayIndex={dayIndex}
              workflowResult={hasResults ? workflowResult : undefined}
              onSelectDay={handleSelectDay}
            />
          )}

          {/* Dedicated 24h Timeline Scrubber ('Curseur Temporel 24h') — Permanently visible outside tabs */}
          <TimelineScrubber
            timeIndex={timeIndex}
            onTimeChange={setTimeIndex}
            stepResult={stepAtTime}
            hasResults={hasResults}
            isPlaying={isPlaying}
            onTogglePlay={togglePlaySimulation}
            onPause={pauseSimulation}
            onStop={stopSimulation}
            onRestart={restartSimulation}
          />
        </div>

        {/* Right Side: Collapsible Multi-Tab Drawer */}
        {isPanelOpen && (
          <aside
            aria-label={tSim('deckTitle')}
            className="lg:col-span-5 xl:col-span-4 flex flex-col rounded-card bg-surface border border-border shadow-md overflow-hidden"
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-elevated/40">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-energy-cyan animate-pulse" />
                <h2 className="text-xs font-display font-semibold uppercase tracking-wider text-text-primary">
                  {tSim('deckTitle')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsPanelOpen(false)}
                aria-label={tCommon('close')}
                title={tSim('hideDeck')}
                className="flex items-center gap-1 px-2 py-1 rounded-control text-xs text-text-muted hover:text-text-primary hover:bg-surface-elevated border border-border transition-colors cursor-pointer"
              >
                <PanelRightClose className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="text-[11px] font-sans">{tSim('hideDeck')}</span>
              </button>
            </div>

            {/* TAB NAVIGATION BAR */}
            <div
              role="tablist"
              aria-label={tSim('deckTitle')}
              className="grid grid-cols-4 border-b border-border bg-canvas-sunken/60 p-1 gap-1"
            >
              {TABS.map(({ id, labelKey, icon: Icon }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    role="tab"
                    type="button"
                    id={`tab-${id}`}
                    aria-controls={`panel-${id}`}
                    aria-selected={isActive}
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-control-sm text-[11px] font-sans transition-all cursor-pointer',
                      isActive
                        ? 'bg-surface-elevated text-energy-cyan font-semibold shadow-xs border border-border/80'
                        : 'text-text-muted hover:text-text-primary hover:bg-surface/50'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-3.5 w-3.5',
                        isActive ? 'text-energy-cyan' : 'text-text-muted'
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate max-w-full">{tSim(labelKey)}</span>
                  </button>
                );
              })}
            </div>

            {/* Scrollable Tab Panels Container */}
            <div className="p-4 max-h-[calc(100vh-220px)] overflow-y-auto">
              {/* TAB 1: METRICS & CHARTS */}
              <div
                id="panel-metrics"
                role="tabpanel"
                aria-labelledby="tab-metrics"
                hidden={activeTab !== 'metrics'}
                className={cn('space-y-4', activeTab !== 'metrics' && 'hidden')}
              >
                {/* 4 Metric Cards in 2x2 grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    status={
                      metrics && metrics.socEndPct < input.battery.minSocPct + 5
                        ? 'warning'
                        : 'normal'
                    }
                    icon={
                      <BatteryCharging className="h-4 w-4 text-battery-green" aria-hidden="true" />
                    }
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

                {/* 24h Generation vs Demand Chart */}
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
                  {/* Recharts can't measure a hidden tab (0×0): mount only when shown. */}
                  {activeTab === 'metrics' && (
                    <EnergyOverTimeChart
                      steps={steps}
                      cursorHour={hasResults ? timeIndex : undefined}
                      height={220}
                    />
                  )}
                </ChartCard>

                {/* Service Allocation Breakdown */}
                <div className="p-4 rounded-card bg-surface-elevated/40 border border-border">
                  <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-text-primary">
                      {tOverview('serviceAllocationTitle')}
                    </h3>
                    <span className="text-[10px] font-mono text-text-muted">
                      {tOverview('sectorsCount', { count: sectorsOrder.length })}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-col gap-2.5">
                    {sectorsOrder.map((sec) => {
                      const secMetrics = metrics?.perSector[sec];
                      const priority = input.sectors.find((s) => s.id === sec)?.priority;

                      return (
                        <EnergyBar
                          key={sec}
                          sectorId={sec}
                          label={tSectors(sec)}
                          valuePct={secMetrics?.coveragePct ?? 0}
                          empty={!hasResults || !secMetrics}
                          demandKwh={secMetrics?.demandKwh}
                          servedKwh={secMetrics?.servedKwh}
                          priority={priority}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* TAB 2: CONTROLS & PARAMETERS */}
              <div
                id="panel-controls"
                role="tabpanel"
                aria-labelledby="tab-controls"
                hidden={activeTab !== 'controls'}
                className={cn('space-y-4', activeTab !== 'controls' && 'hidden')}
              >
                <SimControlsPanel
                  input={input}
                  activeStrategy={activeStrategy}
                  status={status}
                  isPlaying={isPlaying}
                  hasResults={hasResults}
                  onPatch={patchInput}
                  onStrategyChange={selectStrategy}
                  onRun={togglePlaySimulation}
                  onReset={resetScenario}
                  onStop={stopSimulation}
                  onRestart={restartSimulation}
                />
                <WeatherWorkflowPanel
                  workflow={workflow}
                  dayIndex={dayIndex}
                  workflowResult={hasResults ? workflowResult : undefined}
                  onAddDay={() => addWorkflowDay()}
                  onRemoveDay={removeWorkflowDay}
                  onSetWeather={setDayWeather}
                  onSelectDay={handleSelectDay}
                />
                <HardwareLinkSection />
              </div>

              {/* TAB 3: BUILDING INSPECTOR */}
              <div
                id="panel-buildings"
                role="tabpanel"
                aria-labelledby="tab-buildings"
                hidden={activeTab !== 'buildings'}
                className={cn('space-y-4', activeTab !== 'buildings' && 'hidden')}
              >
                <SectorLoadPanel />
                <BuildingInspectorPanel
                  selectedSector={selectedSector}
                  onSelectSector={handleSelectSector}
                  result={result}
                  input={input}
                  timeIndex={timeIndex}
                />
              </div>

              {/* TAB 4: AI COPILOT */}
              <div
                id="panel-copilot"
                role="tabpanel"
                aria-labelledby="tab-copilot"
                hidden={activeTab !== 'copilot'}
                className={cn('space-y-4', activeTab !== 'copilot' && 'hidden')}
              >
                {/* Impact Alerts Banner if active warnings exist */}
                {result && result.warnings.length > 0 && (
                  <ImpactBanner warnings={result.warnings} />
                )}

                {/* Copilot conversational workspace in panel mode */}
                <div className="rounded-card bg-surface-elevated/30 border border-border p-3">
                  <CopilotWorkspace mode="panel" />
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
