'use client';

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { StepResult } from '@mitsinjo/engine';
import { fmtHour, fmtKw, fmtPct } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';

export interface EnergyOverTimeChartProps {
  steps: readonly StepResult[];
  height?: number;
  className?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: number;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0 || label === undefined) {
    return null;
  }

  const hourStr = fmtHour(label);

  return (
    <div className="rounded-card bg-surface-elevated/95 p-3 shadow-lg border border-border backdrop-blur text-xs font-mono">
      <p className="font-sans font-semibold text-text-primary mb-1.5 pb-1 border-b border-border/60">
        {hourStr}
      </p>
      <div className="flex flex-col gap-1">
        {payload.map((entry) => {
          const isSoc = entry.dataKey === 'socPct';
          const formattedVal = isSoc ? fmtPct(entry.value) : fmtKw(entry.value);
          return (
            <div key={entry.name} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-text-secondary">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}:
              </span>
              <span className="font-medium text-text-primary">{formattedVal}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EnergyOverTimeChart({ steps, height = 260, className }: EnergyOverTimeChartProps) {
  const tCharts = useTranslations('charts');

  const chartData = steps.map((s) => ({
    hour: s.t,
    solarKw: Math.round(s.solarKw * 10) / 10,
    demandKw: Math.round(s.demandKw * 10) / 10,
    servedKw: Math.round(s.servedKw * 10) / 10,
    socPct: Math.round(s.socPct * 10) / 10,
  }));

  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={height}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id="solarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-solar-amber)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--color-solar-amber)" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="servedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-battery-green)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--color-battery-green)" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            opacity={0.4}
            vertical={false}
          />

          <XAxis
            dataKey="hour"
            tickFormatter={(val: number) => fmtHour(val)}
            stroke="var(--color-text-muted)"
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-border)' }}
          />

          {/* Left Y Axis: Power in kW */}
          <YAxis
            yAxisId="power"
            stroke="var(--color-text-muted)"
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickLine={false}
            axisLine={false}
            unit=" kW"
          />

          {/* Right Y Axis: Battery SoC in % */}
          <YAxis
            yAxisId="soc"
            orientation="right"
            domain={[0, 100]}
            stroke="var(--color-battery-green)"
            tick={{ fontSize: 11, fill: 'var(--color-battery-green)' }}
            tickLine={false}
            axisLine={false}
            unit="%"
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Solar PV Area */}
          <Area
            yAxisId="power"
            type="monotone"
            dataKey="solarKw"
            name={tCharts('solar')}
            stroke="var(--color-solar-amber)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#solarGradient)"
          />

          {/* Total Demand Line */}
          <Line
            yAxisId="power"
            type="monotone"
            dataKey="demandKw"
            name={tCharts('demand')}
            stroke="var(--color-energy-cyan)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />

          {/* Served Power Area */}
          <Area
            yAxisId="power"
            type="monotone"
            dataKey="servedKw"
            name={tCharts('served')}
            stroke="var(--color-battery-green)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#servedGradient)"
          />

          {/* Battery SoC Line on Right Axis */}
          <Line
            yAxisId="soc"
            type="monotone"
            dataKey="socPct"
            name={tCharts('soc')}
            stroke="var(--color-battery-green)"
            strokeWidth={1.75}
            strokeDasharray="3 3"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
