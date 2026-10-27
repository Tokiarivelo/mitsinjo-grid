'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SimulationResult, StrategyId } from '@mitsinjo/engine';
import { useTranslations } from '@/lib/i18n';

export interface StrategyComparisonChartProps {
  comparison: Partial<Record<StrategyId, SimulationResult>>;
  height?: number;
  className?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-card bg-surface-elevated/95 p-3 shadow-lg border border-border backdrop-blur text-xs font-mono">
      <p className="font-sans font-semibold text-text-primary mb-1.5 pb-1 border-b border-border/60">
        {label}
      </p>
      <div className="flex flex-col gap-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-text-secondary">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}:
            </span>
            <span className="font-medium text-text-primary">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StrategyComparisonChart({
  comparison,
  height = 280,
  className,
}: StrategyComparisonChartProps) {
  const tStrategies = useTranslations('strategies');
  const tCharts = useTranslations('charts');

  const prop = comparison.proportional;
  const ess = comparison.essential_first;
  const bal = comparison.balanced;

  // 4 metrics compared across strategies
  const metrics = [
    {
      metric: tCharts('deliveredEnergy'),
      unit: 'kWh',
      proportional: prop ? Math.round(prop.metrics.servedKwh * 10) / 10 : 0,
      essential_first: ess ? Math.round(ess.metrics.servedKwh * 10) / 10 : 0,
      ...(bal ? { balanced: Math.round(bal.metrics.servedKwh * 10) / 10 } : {}),
    },
    {
      metric: tCharts('criticalCoverage'),
      unit: '%',
      proportional: prop ? Math.round(prop.metrics.criticalCoveragePct * 10) / 10 : 0,
      essential_first: ess ? Math.round(ess.metrics.criticalCoveragePct * 10) / 10 : 0,
      ...(bal ? { balanced: Math.round(bal.metrics.criticalCoveragePct * 10) / 10 } : {}),
    },
    {
      metric: tCharts('unservedEnergy'),
      unit: 'kWh',
      proportional: prop ? Math.round(prop.metrics.unservedKwh * 10) / 10 : 0,
      essential_first: ess ? Math.round(ess.metrics.unservedKwh * 10) / 10 : 0,
      ...(bal ? { balanced: Math.round(bal.metrics.unservedKwh * 10) / 10 } : {}),
    },
    {
      metric: tCharts('endSoc'),
      unit: '%',
      proportional: prop ? Math.round(prop.metrics.socEndPct * 10) / 10 : 0,
      essential_first: ess ? Math.round(ess.metrics.socEndPct * 10) / 10 : 0,
      ...(bal ? { balanced: Math.round(bal.metrics.socEndPct * 10) / 10 } : {}),
    },
  ];

  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={height}>
        <BarChart
          data={metrics}
          margin={{ top: 15, right: 15, left: -10, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border, #303443)"
            opacity={0.4}
            vertical={false}
          />
          <XAxis
            dataKey="metric"
            stroke="var(--color-text-secondary, #b6bed3)"
            tick={{ fontSize: 11, fill: 'var(--color-text-secondary, #b6bed3)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-border, #303443)' }}
          />
          <YAxis
            stroke="var(--color-text-muted, #7c859e)"
            tick={{ fontSize: 11, fill: 'var(--color-text-muted, #7c859e)' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 10, fontSize: 12 }}
            formatter={(value: string) => (
              <span className="text-text-secondary font-sans text-xs">{value}</span>
            )}
          />
          <Bar
            dataKey="proportional"
            name={tStrategies('proportional')}
            fill="#50d8e8"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="essential_first"
            name={tStrategies('essential_first')}
            fill="#ffb547"
            radius={[4, 4, 0, 0]}
          />
          {bal && (
            <Bar
              dataKey="balanced"
              name={tStrategies('balanced')}
              fill="#76f7be"
              radius={[4, 4, 0, 0]}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
