'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  Download,
  Factory,
  HeartPulse,
  Play,
  RotateCcw,
  Sun,
  Zap,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { AppShell } from '@/components/layout/app-shell';
import {
  Button,
  StatusBadge,
  MetricCard,
  EnergyBar,
  SimControl,
  EmptyState,
  ChartCard,
  ScenarioSelector,
  type StatusBadgeVariant,
} from '@/components/ui';

export function DesignSystemPage() {
  const tRoutes = useTranslations('routes');
  const tDesign = useTranslations('ui.design');
  const tMetrics = useTranslations('metrics');
  const tActions = useTranslations('actions');
  const tScenarios = useTranslations('scenarios');

  const [sliderVal, setSliderVal] = useState(40);
  const [scenarioId, setScenarioId] = useState('cloudy_afternoon');
  const [modified, setModified] = useState(true);

  return (
    <AppShell title={tRoutes('design.title')} subtitle={tRoutes('design.subtitle')}>
      <div className="max-w-6xl mx-auto space-y-10 pb-16">
        {/* Banner */}
        <div className="p-4 rounded-card bg-surface border border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-control-sm bg-energy-cyan/10 text-energy-cyan border border-energy-cyan/20">
              <Zap className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-sm font-semibold text-text-primary">
                {tDesign('catalogTitle')}
              </h2>
              <p className="text-xs text-text-secondary">
                {tDesign('catalogSubtitle')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge variant="simulated" />
            <StatusBadge variant="ai" label={tDesign('tokenAudited')} />
          </div>
        </div>

        {/* Section 1: Color Tokens */}
        <section className="space-y-4">
          <h3 className="font-display text-base font-semibold text-text-primary border-b border-border pb-2">
            {tDesign('sec1Title')}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
            <div className="p-3 rounded-card bg-canvas border border-border flex flex-col gap-2">
              <div className="h-8 rounded-control-sm bg-canvas border border-border" />
              <span className="font-mono text-[11px] text-text-primary">canvas</span>
              <span className="text-[10px] text-text-muted">{tDesign('palette.canvasDesc')}</span>
            </div>
            <div className="p-3 rounded-card bg-surface border border-border flex flex-col gap-2">
              <div className="h-8 rounded-control-sm bg-surface border border-border-strong" />
              <span className="font-mono text-[11px] text-text-primary">surface</span>
              <span className="text-[10px] text-text-muted">{tDesign('palette.surfaceDesc')}</span>
            </div>
            <div className="p-3 rounded-card bg-surface border border-border flex flex-col gap-2">
              <div className="h-8 rounded-control-sm bg-solar-amber" />
              <span className="font-mono text-[11px] text-solar-amber">solar-amber</span>
              <span className="text-[10px] text-text-muted">{tDesign('palette.solarAmberDesc')}</span>
            </div>
            <div className="p-3 rounded-card bg-surface border border-border flex flex-col gap-2">
              <div className="h-8 rounded-control-sm bg-energy-cyan" />
              <span className="font-mono text-[11px] text-energy-cyan">energy-cyan</span>
              <span className="text-[10px] text-text-muted">{tDesign('palette.energyCyanDesc')}</span>
            </div>
            <div className="p-3 rounded-card bg-surface border border-border flex flex-col gap-2">
              <div className="h-8 rounded-control-sm bg-battery-green" />
              <span className="font-mono text-[11px] text-battery-green">battery-green</span>
              <span className="text-[10px] text-text-muted">{tDesign('palette.batteryGreenDesc')}</span>
            </div>
            <div className="p-3 rounded-card bg-surface border border-border flex flex-col gap-2">
              <div className="h-8 rounded-control-sm bg-ai-violet" />
              <span className="font-mono text-[11px] text-ai-violet">ai-violet</span>
              <span className="text-[10px] text-text-muted">{tDesign('palette.aiVioletDesc')}</span>
            </div>
            <div className="p-3 rounded-card bg-surface border border-border flex flex-col gap-2">
              <div className="h-8 rounded-control-sm bg-warning-amber" />
              <span className="font-mono text-[11px] text-warning-amber">warning-amber</span>
              <span className="text-[10px] text-text-muted">{tDesign('palette.warningAmberDesc')}</span>
            </div>
            <div className="p-3 rounded-card bg-surface border border-border flex flex-col gap-2">
              <div className="h-8 rounded-control-sm bg-critical-red" />
              <span className="font-mono text-[11px] text-critical-red">critical-red</span>
              <span className="text-[10px] text-text-muted">{tDesign('palette.criticalRedDesc')}</span>
            </div>
          </div>
        </section>

        {/* Section 2: Buttons */}
        <section className="space-y-4">
          <h3 className="font-display text-base font-semibold text-text-primary border-b border-border pb-2">
            {tDesign('sec2Title')}
          </h3>
          <div className="p-5 rounded-card bg-surface border border-border space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" icon={<Play className="h-3.5 w-3.5" />}>
                {tActions('runSimulation')}
              </Button>
              <Button variant="secondary" icon={<RotateCcw className="h-3.5 w-3.5" />}>
                {tActions('resetScenario')}
              </Button>
              <Button variant="ghost" icon={<Download className="h-3.5 w-3.5" />}>
                {tActions('exportJson')}
              </Button>
              <Button variant="danger" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
                {tDesign('emergencyShed')}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border/50">
              <Button variant="primary" size="sm">
                {tDesign('smallPrimary')}
              </Button>
              <Button variant="secondary" size="sm">
                {tDesign('smallSecondary')}
              </Button>
              <Button variant="primary" loading>
                {tDesign('calculating')}
              </Button>
              <Button variant="secondary" disabled>
                {tDesign('disabled')}
              </Button>
            </div>
          </div>
        </section>

        {/* Section 3: Status Badges */}
        <section className="space-y-4">
          <h3 className="font-display text-base font-semibold text-text-primary border-b border-border pb-2">
            {tDesign('sec3Title')}
          </h3>
          <div className="p-5 rounded-card bg-surface border border-border flex flex-wrap gap-3 items-center">
            {(
              ['ready', 'running', 'complete', 'warning', 'critical', 'simulated', 'ai'] as StatusBadgeVariant[]
            ).map((variant) => (
              <StatusBadge key={variant} variant={variant} />
            ))}
          </div>
        </section>

        {/* Section 4: Metric Cards */}
        <section className="space-y-4">
          <h3 className="font-display text-base font-semibold text-text-primary border-b border-border pb-2">
            {tDesign('sec4Title')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              variant="solar"
              label={tMetrics('solar.label')}
              value={40}
              unit="kWp"
              delta={{ value: '+198', direction: 'up', label: tMetrics('solar.today') }}
              icon={<Sun className="h-4 w-4 text-solar-amber" />}
            />
            <MetricCard
              variant="battery"
              label={tMetrics('battery.label')}
              value={68.4}
              unit="%"
              caption={tMetrics('battery.caption')}
              icon={<BatteryCharging className="h-4 w-4 text-battery-green" />}
            />
            <MetricCard
              variant="demand"
              label={tMetrics('demand.label')}
              value={128.5}
              unit="kWh"
              delta={{ value: '100%', direction: 'neutral', label: tMetrics('demand.served') }}
              icon={<Factory className="h-4 w-4 text-energy-cyan" />}
            />
            <MetricCard
              variant="essential"
              label={tMetrics('essential.label')}
              value={100}
              unit="%"
              caption={tMetrics('essential.caption')}
              icon={<HeartPulse className="h-4 w-4 text-battery-green" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <MetricCard
              variant="essential"
              label={tDesign('clinicSupplyLabel')}
              value={78.2}
              unit="%"
              status="critical"
              caption={tDesign('clinicShortfallCaption')}
            />
            <MetricCard
              variant="battery"
              label={tDesign('batteryLowLabel')}
              value={20.1}
              unit="%"
              status="warning"
              caption={tDesign('batteryLowCaption')}
            />
            <MetricCard
              variant="demand"
              label={tDesign('loadingLabel')}
              value={0}
              unit="kWh"
              loading
            />
          </div>
        </section>

        {/* Section 5: Energy Bars */}
        <section className="space-y-4">
          <h3 className="font-display text-base font-semibold text-text-primary border-b border-border pb-2">
            {tDesign('sec5Title')}
          </h3>
          <div className="p-5 rounded-card bg-surface border border-border space-y-3">
            <EnergyBar
              label={tDesign('healthClinic')}
              priority="critical"
              valuePct={100}
              servedKwh={20.4}
              demandKwh={20.4}
              status="full"
            />
            <EnergyBar
              label={tDesign('waterPumping')}
              priority="high"
              valuePct={85.2}
              servedKwh={20.4}
              demandKwh={24.0}
              status="partial"
            />
            <EnergyBar
              label={tDesign('primarySchool')}
              priority="medium"
              valuePct={100}
              servedKwh={14.0}
              demandKwh={14.0}
              status="full"
            />
            <EnergyBar
              label={tDesign('villageHouseholds')}
              priority="medium"
              valuePct={72.0}
              servedKwh={36.0}
              demandKwh={50.0}
              status="partial"
            />
            <EnergyBar
              label={tDesign('localMarket')}
              priority="low"
              valuePct={45.0}
              servedKwh={9.0}
              demandKwh={20.0}
              status="partial"
            />
          </div>
        </section>

        {/* Section 6: SimControls & Scenario Selector */}
        <section className="space-y-4">
          <h3 className="font-display text-base font-semibold text-text-primary border-b border-border pb-2">
            {tDesign('sec6Title')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SimControl
              label={tDesign('solarDeficit')}
              value={sliderVal}
              unit="%"
              min={0}
              max={90}
              step={5}
              onChange={setSliderVal}
              description={tDesign('solarDeficitDesc')}
            />
            <div className="p-5 rounded-card bg-surface border border-border flex flex-col justify-between gap-4">
              <div>
                <span className="font-sans text-xs font-medium text-text-primary block mb-1">
                  {tDesign('scenarioSelection')}
                </span>
                <p className="text-xs text-text-muted mb-3">
                  {tDesign('scenarioSelectionDesc')}
                </p>
                <ScenarioSelector
                  scenarios={[
                    { id: 'baseline', name: tScenarios('baseline.name') },
                    { id: 'cloudy_afternoon', name: tScenarios('cloudy_afternoon.name') },
                    { id: 'high_demand', name: tScenarios('high_demand.name') },
                  ]}
                  value={scenarioId}
                  modified={modified}
                  onChange={setScenarioId}
                />
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModified(!modified)}
                >
                  {tDesign('toggleModifiedWithState', {
                    state: modified ? tDesign('active') : tDesign('off'),
                  })}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 7: ChartCard & EmptyState */}
        <section className="space-y-4">
          <h3 className="font-display text-base font-semibold text-text-primary border-b border-border pb-2">
            {tDesign('sec7Title')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartCard
              title={tDesign('energyBalanceTitle')}
              subtitle={tDesign('energyBalanceSubtitle')}
              unit="kW"
              summary={tDesign('energyBalanceSummary')}
            >
              <div className="h-48 flex items-center justify-center rounded-control bg-canvas border border-border text-xs text-text-muted font-mono">
                {tDesign('chartPlaceholder')}
              </div>
            </ChartCard>

            <ChartCard
              title={tDesign('strategyCompareTitle')}
              subtitle={tDesign('strategyCompareSubtitle')}
              unit="kWh"
              summary={tDesign('strategyCompareSummary')}
              empty
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <EmptyState
              title={tDesign('readySimulateTitle')}
              description={tDesign('readySimulateDesc')}
              actionLabel={tDesign('runFirstSim')}
              onAction={() => {}}
            />
            <EmptyState
              title={tDesign('simErrorTitle')}
              description={tDesign('simErrorDesc')}
              actionLabel={tDesign('resetDefaults')}
              tone="error"
              onAction={() => {}}
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
