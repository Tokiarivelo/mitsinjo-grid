'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { StrategyId, SweepParam, SweepResult } from '@mitsinjo/engine';
import { ChartCard } from '@/components/ui/chart-card';
import { STRATEGY_COLORS } from '@/components/charts/strategy-colors';
import { fmtKwh } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { fmtSweepValue } from '../utils/sweep-value';

export interface SensitivityChartProps {
  result: SweepResult;
  param: SweepParam;
  currentValue: number;
  strategies: readonly StrategyId[];
  onParamChange: (param: SweepParam) => void;
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
  param: SweepParam;
}

function CustomTooltip({ active, payload, label, param }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0 || label === undefined) {
    return null;
  }

  const formattedLabel = fmtSweepValue(param, label);

  return (
    <div className="rounded-card bg-surface-elevated/95 p-3 shadow-lg border border-border backdrop-blur text-xs font-mono">
      <p className="font-sans font-semibold text-text-primary mb-1.5 pb-1 border-b border-border/60">
        {formattedLabel}
      </p>
      <div className="flex flex-col gap-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-text-secondary">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}:
            </span>
            <span className="font-medium text-text-primary">{fmtKwh(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const STRATEGY_ORDER = Object.keys(STRATEGY_COLORS) as StrategyId[];

export function SensitivityChart({
  result,
  param,
  currentValue,
  strategies,
  onParamChange,
  height = 300,
  className,
}: SensitivityChartProps) {
  const tStrategies = useTranslations('strategies');

  const paramOptions: { id: SweepParam; label: string }[] = [
    { id: 'solarDropPct', label: tStrategies('sensitivity.params.solarDropPct') },
    { id: 'demandMultiplier', label: tStrategies('sensitivity.params.demandMultiplier') },
    { id: 'initialSocPct', label: tStrategies('sensitivity.params.initialSocPct') },
  ];

  const paramLabel = tStrategies(`sensitivity.params.${param}`);

  const chartData = result.map((p) => {
    const row: Record<string, number> = { value: p.value };
    for (const id of STRATEGY_ORDER) {
      const m = p.metrics[id];
      if (m) row[id] = m.criticalUnservedKwh;
    }
    return row;
  });

  const paramPicker = (
    <div
      role="radiogroup"
      aria-label={tStrategies('sensitivity.paramLabel')}
      className="flex flex-wrap items-center gap-1.5 p-1 rounded-control bg-canvas border border-border"
    >
      {paramOptions.map((opt) => {
        const isSelected = param === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onParamChange(opt.id)}
            className={cn(
              'min-h-[40px] px-3 py-1.5 rounded-control-sm text-xs font-medium transition-colors cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar-amber',
              isSelected
                ? 'bg-surface-elevated text-text-primary shadow-xs border border-border/80'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface/50'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <ChartCard
      title={tStrategies('sensitivity.title')}
      subtitle={tStrategies('sensitivity.subtitle')}
      unit="kWh"
      summary={tStrategies('sensitivity.summary', { param: paramLabel })}
      legend={paramPicker}
      empty={result.length === 0}
      emptyTitle={tStrategies('sensitivity.emptyTitle')}
      emptyDescription={tStrategies('sensitivity.emptyDesc')}
      className={className}
    >
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%" debounce={100}>
          <LineChart data={chartData} margin={{ top: 12, right: 24, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.6} />
            <XAxis
              dataKey="value"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v: number) => fmtSweepValue(param, v)}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `${v}`}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickLine={false}
              width={40}
            />
            <Tooltip
              content={<CustomTooltip param={param} />}
              cursor={{ stroke: 'var(--color-border-strong)', strokeDasharray: '4 4' }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: 12 }}
              formatter={(value: string) => (
                <span className="text-xs text-text-secondary">{value}</span>
              )}
            />
            <ReferenceLine
              x={currentValue}
              stroke="var(--color-text-muted)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: tStrategies('sensitivity.markerLabel'),
                position: 'top',
                fill: 'var(--color-text-muted)',
                fontSize: 10,
              }}
            />
            {STRATEGY_ORDER.filter((id) => strategies.includes(id)).map((id) => (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                name={tStrategies(id)}
                stroke={STRATEGY_COLORS[id]}
                strokeWidth={2}
                dot={{ r: 3, fill: STRATEGY_COLORS[id] }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
