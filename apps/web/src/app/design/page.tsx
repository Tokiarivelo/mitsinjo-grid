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

export default function DesignSystemPage() {
  const [sliderVal, setSliderVal] = useState(40);
  const [scenarioId, setScenarioId] = useState('cloudy_afternoon');
  const [modified, setModified] = useState(true);

  return (
    <AppShell title="Design System & UI Kit" subtitle="Solar Observatory × Mission Control components & tokens">
      <div className="max-w-6xl mx-auto space-y-10 pb-16">
        {/* Banner */}
        <div className="p-4 rounded-card bg-surface border border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-control-sm bg-energy-cyan/10 text-energy-cyan border border-energy-cyan/20">
              <Zap className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-sm font-semibold text-text-primary">
                Design System Catalog
              </h2>
              <p className="text-xs text-text-secondary">
                Tailwind v4 tokens, interactive states, and WCAG AA accessible primitives.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge variant="simulated" />
            <StatusBadge variant="ai" label="TOKEN AUDITED" />
          </div>
        </div>

        {/* Section 1: Color Tokens */}
        <section className="space-y-4">
          <h3 className="font-display text-base font-semibold text-text-primary border-b border-border pb-2">
            1. Core Palette Tokens
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
            <div className="p-3 rounded-card bg-canvas border border-border flex flex-col gap-2">
              <div className="h-8 rounded-control-sm bg-canvas border border-border" />
              <span className="font-mono text-[11px] text-text-primary">canvas</span>
              <span className="text-[10px] text-text-muted">base bg</span>
            </div>
            <div className="p-3 rounded-card bg-surface border border-border flex flex-col gap-2">
              <div className="h-8 rounded-control-sm bg-surface border border-border-strong" />
              <span className="font-mono text-[11px] text-text-primary">surface</span>
              <span className="text-[10px] text-text-muted">card/panel</span>
            </div>
            <div className="p-3 rounded-card bg-surface border border-border flex flex-col gap-2">
              <div className="h-8 rounded-control-sm bg-solar-amber" />
              <span className="font-mono text-[11px] text-solar-amber">solar-amber</span>
              <span className="text-[10px] text-text-muted">solar PV</span>
            </div>
            <div className="p-3 rounded-card bg-surface border border-border flex flex-col gap-2">
              <div className="h-8 rounded-control-sm bg-energy-cyan" />
              <span className="font-mono text-[11px] text-energy-cyan">energy-cyan</span>
              <span className="text-[10px] text-text-muted">energy flow</span>
            </div>
            <div className="p-3 rounded-card bg-surface border border-border flex flex-col gap-2">
              <div className="h-8 rounded-control-sm bg-battery-green" />
              <span className="font-mono text-[11px] text-battery-green">battery-green</span>
              <span className="text-[10px] text-text-muted">battery/ok</span>
            </div>
            <div className="p-3 rounded-card bg-surface border border-border flex flex-col gap-2">
              <div className="h-8 rounded-control-sm bg-ai-violet" />
              <span className="font-mono text-[11px] text-ai-violet">ai-violet</span>
              <span className="text-[10px] text-text-muted">copilot</span>
            </div>
            <div className="p-3 rounded-card bg-surface border border-border flex flex-col gap-2">
              <div className="h-8 rounded-control-sm bg-warning-amber" />
              <span className="font-mono text-[11px] text-warning-amber">warning-amber</span>
              <span className="text-[10px] text-text-muted">shortage</span>
            </div>
            <div className="p-3 rounded-card bg-surface border border-border flex flex-col gap-2">
              <div className="h-8 rounded-control-sm bg-critical-red" />
              <span className="font-mono text-[11px] text-critical-red">critical-red</span>
              <span className="text-[10px] text-text-muted">unmet essential</span>
            </div>
          </div>
        </section>

        {/* Section 2: Buttons */}
        <section className="space-y-4">
          <h3 className="font-display text-base font-semibold text-text-primary border-b border-border pb-2">
            2. Button Variants & States
          </h3>
          <div className="p-5 rounded-card bg-surface border border-border space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" icon={<Play className="h-3.5 w-3.5" />}>
                Run simulation
              </Button>
              <Button variant="secondary" icon={<RotateCcw className="h-3.5 w-3.5" />}>
                Reset scenario
              </Button>
              <Button variant="ghost" icon={<Download className="h-3.5 w-3.5" />}>
                Export JSON
              </Button>
              <Button variant="danger" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
                Emergency shed
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border/50">
              <Button variant="primary" size="sm">
                Small Primary
              </Button>
              <Button variant="secondary" size="sm">
                Small Secondary
              </Button>
              <Button variant="primary" loading>
                Calculating
              </Button>
              <Button variant="secondary" disabled>
                Disabled
              </Button>
            </div>
          </div>
        </section>

        {/* Section 3: Status Badges */}
        <section className="space-y-4">
          <h3 className="font-display text-base font-semibold text-text-primary border-b border-border pb-2">
            3. StatusBadge Variants (Always includes visible label)
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
            4. MetricCards (Solar, Battery, Demand, Essential Services)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              variant="solar"
              label="Solar PV Peak"
              value={40}
              unit="kWp"
              delta={{ value: '+198', direction: 'up', label: 'kWh today' }}
              icon={<Sun className="h-4 w-4 text-solar-amber" />}
            />
            <MetricCard
              variant="battery"
              label="Battery SoC"
              value={68.4}
              unit="%"
              caption="Capacity 120 kWh (reserve 20%)"
              icon={<BatteryCharging className="h-4 w-4 text-battery-green" />}
            />
            <MetricCard
              variant="demand"
              label="Total Demand"
              value={128.5}
              unit="kWh"
              delta={{ value: '100%', direction: 'neutral', label: 'served' }}
              icon={<Factory className="h-4 w-4 text-energy-cyan" />}
            />
            <MetricCard
              variant="essential"
              label="Essential Services"
              value={100}
              unit="%"
              caption="Health clinic & pumping protected"
              icon={<HeartPulse className="h-4 w-4 text-battery-green" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <MetricCard
              variant="essential"
              label="Clinic Supply (Shortfall)"
              value={78.2}
              unit="%"
              status="critical"
              caption="2.4 kWh essential deficit at 19:00"
            />
            <MetricCard
              variant="battery"
              label="Battery Reserve (Low)"
              value={20.1}
              unit="%"
              status="warning"
              caption="Approaching 20% reserve limit"
            />
            <MetricCard
              variant="demand"
              label="Loading / Skeleton State"
              value={0}
              unit="kWh"
              loading
            />
          </div>
        </section>

        {/* Section 5: Energy Bars */}
        <section className="space-y-4">
          <h3 className="font-display text-base font-semibold text-text-primary border-b border-border pb-2">
            5. EnergyBars (Sector Allocations)
          </h3>
          <div className="p-5 rounded-card bg-surface border border-border space-y-3">
            <EnergyBar
              label="Health Clinic"
              priority="critical"
              valuePct={100}
              servedKwh={20.4}
              demandKwh={20.4}
              status="full"
            />
            <EnergyBar
              label="Water Pumping Station"
              priority="high"
              valuePct={85.2}
              servedKwh={20.4}
              demandKwh={24.0}
              status="partial"
            />
            <EnergyBar
              label="Primary School"
              priority="medium"
              valuePct={100}
              servedKwh={14.0}
              demandKwh={14.0}
              status="full"
            />
            <EnergyBar
              label="Village Households"
              priority="medium"
              valuePct={72.0}
              servedKwh={36.0}
              demandKwh={50.0}
              status="partial"
            />
            <EnergyBar
              label="Local Market & Artisans"
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
            6. Controls & Scenario Switcher
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SimControl
              label="Solar Drop Deficit"
              value={sliderVal}
              unit="%"
              min={0}
              max={90}
              step={5}
              onChange={setSliderVal}
              description="Simulate sudden cloud cover or dust accumulation on solar array panels."
            />
            <div className="p-5 rounded-card bg-surface border border-border flex flex-col justify-between gap-4">
              <div>
                <span className="font-sans text-xs font-medium text-text-primary block mb-1">
                  Scenario Selection
                </span>
                <p className="text-xs text-text-muted mb-3">
                  Switch between standard test cases and track modification state.
                </p>
                <ScenarioSelector
                  scenarios={[
                    { id: 'baseline', name: 'Baseline 24h Nominal' },
                    { id: 'cloudy_afternoon', name: 'Cloudy Afternoon (-40%)' },
                    { id: 'high_demand', name: 'High Evening Demand (+30%)' },
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
                  Toggle Modified Badge ({modified ? 'Active' : 'Off'})
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 7: ChartCard & EmptyState */}
        <section className="space-y-4">
          <h3 className="font-display text-base font-semibold text-text-primary border-b border-border pb-2">
            7. ChartCard & Empty State
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartCard
              title="Energy Balance 24h"
              subtitle="Hourly production vs consumption curves"
              unit="kW"
              summary="Solar generation peaks at 12:00 at 38 kW. Evening demand peaks at 19:00 at 12 kW."
            >
              <div className="h-48 flex items-center justify-center rounded-control bg-canvas border border-border text-xs text-text-muted font-mono">
                [Recharts container will render here in P4]
              </div>
            </ChartCard>

            <ChartCard
              title="Strategy Comparison"
              subtitle="Proportional vs Essential-First"
              unit="kWh"
              summary="No strategy comparison run yet"
              empty
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <EmptyState
              title="Ready to simulate"
              description="Choose a scenario or adjust solar and battery assumptions above."
              actionLabel="Run first simulation"
              onAction={() => {}}
            />
            <EmptyState
              title="Simulation error"
              description="Solar capacity cannot be zero. Please adjust to at least 1 kWp."
              actionLabel="Reset to defaults"
              tone="error"
              onAction={() => {}}
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
