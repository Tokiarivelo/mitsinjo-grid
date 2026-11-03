'use client';

import { Bar, BarChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ResponsiveChart } from '@/components/charts/responsive-chart';
import { fmtHour, fmtKw, fmtKwh } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';

export interface ApplianceCurveChartProps {
  /** 24 hourly kW values from the engine (`applianceProfileKw`). */
  curve: readonly number[];
  peakKw: number;
  dailyKwh: number;
}

interface CurveTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: number;
}

function CurveTooltip({ active, payload, label }: CurveTooltipProps) {
  if (!active || !payload || payload.length === 0 || label === undefined) return null;
  return (
    <div className="rounded-control border border-border bg-surface-elevated/95 px-2 py-1 font-mono text-[11px] text-text-primary shadow">
      {fmtHour(label)} · {fmtKw(payload[0]!.value)}
    </div>
  );
}

/**
 * Usage-hours chart (PV-T11b): the draft's 24 h engine curve as compact bars. Numbers come from
 * the hook (engine); the text summary keeps the shape readable without the pixels.
 */
export function ApplianceCurveChart({ curve, peakKw, dailyKwh }: ApplianceCurveChartProps) {
  const t = useTranslations('features.visionInsert');
  const data = curve.map((kw, hour) => ({ hour, kw: Math.round(kw * 1000) / 1000 }));
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-xs text-text-secondary">{t('insertCurveTitle')}</figcaption>
      <div className="h-[120px] w-full" aria-hidden="true">
        <ResponsiveChart>
          <BarChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
            <XAxis
              dataKey="hour"
              tickFormatter={(val: number) => fmtHour(val)}
              stroke="var(--color-text-muted)"
              tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              interval={5}
            />
            <YAxis hide domain={[0, Math.max(peakKw * 1.15, 0.001)]} />
            <Tooltip
              content={<CurveTooltip />}
              cursor={{ fill: 'var(--color-border)', opacity: 0.3 }}
            />
            <Bar
              dataKey="kw"
              fill="var(--color-energy-cyan)"
              fillOpacity={0.85}
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveChart>
      </div>
      <p className="sr-only">
        {t('insertCurveSummary', { peak: fmtKw(peakKw, 2), daily: fmtKwh(dailyKwh, 2) })}
      </p>
    </figure>
  );
}
