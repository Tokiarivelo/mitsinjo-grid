'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SectorId, SectorMetrics } from '@mitsinjo/engine';
import { fmtKwh, fmtPct } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';

export interface ServiceCoverageChartProps {
  perSector: Record<SectorId, SectorMetrics>;
  height?: number;
  className?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      name: string;
      coveragePct: number;
      servedKwh: number;
      demandKwh: number;
      unservedKwh: number;
    };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  const tCharts = useTranslations('charts');
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-card bg-surface-elevated/95 p-3 shadow-lg border border-border backdrop-blur text-xs font-mono">
      <p className="font-sans font-semibold text-text-primary mb-1 pb-1 border-b border-border/60">
        {item.name}
      </p>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between gap-4">
          <span className="text-text-secondary">{tCharts('tooltipCoverage')}:</span>
          <span className="font-semibold text-text-primary">{fmtPct(item.coveragePct)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-text-secondary">{tCharts('tooltipServedDemand')}:</span>
          <span className="text-text-primary">
            {fmtKwh(item.servedKwh)} / {fmtKwh(item.demandKwh)}
          </span>
        </div>
        {item.unservedKwh > 0 && (
          <div className="flex justify-between gap-4 text-critical-red">
            <span>{tCharts('tooltipUnmet')}:</span>
            <span>{fmtKwh(item.unservedKwh)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ServiceCoverageChart({
  perSector,
  height = 240,
  className,
}: ServiceCoverageChartProps) {
  const tSectors = useTranslations('sectors');
  const tCharts = useTranslations('charts');

  const sectorOrder: SectorId[] = ['health', 'water', 'school', 'households', 'market'];

  const data = sectorOrder.map((id) => {
    const s = perSector[id];
    const name = tSectors(id);
    const coverage = s ? Math.round(s.coveragePct * 10) / 10 : 0;
    return {
      id,
      name,
      coveragePct: coverage,
      servedKwh: s?.servedKwh ?? 0,
      demandKwh: s?.demandKwh ?? 0,
      unservedKwh: s?.unservedKwh ?? 0,
    };
  });

  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            opacity={0.4}
            horizontal={false}
          />
          <XAxis
            type="number"
            domain={[0, 100]}
            unit="%"
            stroke="var(--color-text-muted)"
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-border)' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            stroke="var(--color-text-secondary)"
            tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="coveragePct"
            name={tCharts('coveragePct')}
            radius={[0, 4, 4, 0]}
            barSize={16}
          >
            {data.map((entry) => {
              let fill = 'var(--color-battery-green)';
              if (entry.coveragePct < 99.9) {
                fill =
                  entry.id === 'health' || entry.id === 'water'
                    ? 'var(--color-critical-red)'
                    : 'var(--color-solar-amber)';
              }
              return <Cell key={`cell-${entry.id}`} fill={fill} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
