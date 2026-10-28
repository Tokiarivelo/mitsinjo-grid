'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { BarChart3, TrendingUp, Layers } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ChatChartData } from '../types';

export interface ChatChartProps {
  data: ChatChartData;
  className?: string;
}

const DEFAULT_COLORS = [
  'var(--color-energy-cyan)',
  'var(--color-solar-amber)',
  'var(--color-ai-violet)',
  'var(--color-critical-red)',
  'var(--color-battery-green)',
  'var(--color-network-blue)',
];

const AXIS_PROPS = {
  tickLine: false,
  axisLine: { stroke: 'var(--color-border)' },
  tick: { fill: 'var(--color-text-muted)', fontSize: 10 },
  className: 'font-mono',
} as const;

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--color-surface-elevated)',
  borderColor: 'var(--color-border)',
  borderRadius: '0.5rem',
  fontSize: '11px',
  fontFamily: 'monospace',
  color: 'var(--color-text-primary)',
};

export function ChatChart({ data, className }: ChatChartProps) {
  const t = useTranslations('features.copilot');
  if (!data || !Array.isArray(data.data) || data.data.length === 0) {
    return null;
  }

  const firstRow = data.data[0];
  const firstKey = firstRow ? Object.keys(firstRow)[0] : 'x';
  const xAxisKey = data.xAxisKey || firstKey || 'x';
  const series = data.series || [];

  const getChartIcon = () => {
    switch (data.type) {
      case 'bar':
        return <BarChart3 className="h-4 w-4 text-energy-cyan" />;
      case 'area':
        return <Layers className="h-4 w-4 text-solar-amber" />;
      case 'line':
      default:
        return <TrendingUp className="h-4 w-4 text-ai-violet" />;
    }
  };

  const renderChart = () => {
    switch (data.type) {
      case 'bar':
        return (
          <BarChart data={data.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey={xAxisKey} {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />}
            {series.map((s, idx) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label || s.key}
                fill={s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        );

      case 'area':
        return (
          <AreaChart data={data.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {series.map((s, idx) => {
                const color = s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
                return (
                  <linearGradient
                    key={`grad-${s.key}`}
                    id={`grad-${s.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey={xAxisKey} {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />}
            {series.map((s, idx) => {
              const color = s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
              return (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label || s.key}
                  stroke={color}
                  fillOpacity={1}
                  fill={`url(#grad-${s.key})`}
                  strokeWidth={2}
                />
              );
            })}
          </AreaChart>
        );

      case 'line':
      default:
        return (
          <LineChart data={data.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey={xAxisKey} {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />}
            {series.map((s, idx) => {
              const color = s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
              return (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label || s.key}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 2, fill: color }}
                  activeDot={{ r: 4 }}
                />
              );
            })}
          </LineChart>
        );
    }
  };

  return (
    <div
      className={cn(
        'my-3 rounded-xl border border-border/80 bg-surface p-4 shadow-sm overflow-hidden flex flex-col gap-2',
        className
      )}
    >
      {(data.title || data.subtitle) && (
        <div className="flex items-center justify-between pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-surface-elevated border border-border/60">
              {getChartIcon()}
            </div>
            <div>
              {data.title && (
                <h4 className="text-xs font-semibold text-text-primary font-display tracking-tight">
                  {data.title}
                </h4>
              )}
              {data.subtitle && (
                <p className="text-[10px] text-text-secondary font-mono">{data.subtitle}</p>
              )}
            </div>
          </div>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted border border-border/50 uppercase">
            {t('chartType', { type: data.type })}
          </span>
        </div>
      )}

      <div className="w-full h-56 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
