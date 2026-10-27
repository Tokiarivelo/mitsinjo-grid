import type {
  Comparison,
  SimulationInput,
  SimulationResult,
  StrategyId,
} from '@mitsinjo/engine';
import { fmtHour, fmtKw, fmtKwh, fmtPct } from './format';

export interface ExportData {
  exportedAt: string;
  scenarioId: string;
  activeStrategy: StrategyId;
  resultId: string | null;
  resultIds: Record<string, string>;
  engineVersion: string | null;
  input: SimulationInput;
  metrics: SimulationResult['metrics'] | null;
  warnings: SimulationResult['warnings'];
  comparisonSummary?: Record<
    string,
    {
      resultId: string;
      servedKwh: number;
      unservedKwh: number;
      criticalCoveragePct: number;
      socEndPct: number;
    }
  >;
}

/**
 * Builds the structured JSON export object containing input, metrics, and result IDs.
 */
export function buildExportData(
  input: SimulationInput,
  result?: SimulationResult,
  comparison?: Partial<Comparison>,
  activeStrategy: StrategyId = 'proportional'
): ExportData {
  const resultIds: Record<string, string> = {};
  const comparisonSummary: ExportData['comparisonSummary'] = {};

  if (comparison) {
    for (const [strat, res] of Object.entries(comparison)) {
      if (res) {
        resultIds[strat] = res.id;
        comparisonSummary[strat] = {
          resultId: res.id,
          servedKwh: res.metrics.servedKwh,
          unservedKwh: res.metrics.unservedKwh,
          criticalCoveragePct: res.metrics.criticalCoveragePct,
          socEndPct: res.metrics.socEndPct,
        };
      }
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    scenarioId: input.scenarioId,
    activeStrategy,
    resultId: result?.id ?? null,
    resultIds,
    engineVersion: result?.engineVersion ?? null,
    input,
    metrics: result?.metrics ?? null,
    warnings: result?.warnings ?? [],
    comparisonSummary: Object.keys(comparisonSummary).length > 0 ? comparisonSummary : undefined,
  };
}

/** Root-level translator (e.g. `useTranslations()` from `@/lib/i18n`). */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Generates a human-readable Markdown summary report for clipboard export,
 * in the caller's locale. All copy comes from the `export` i18n namespace.
 */
export function generateSummaryMarkdown(
  t: Translate,
  input: SimulationInput,
  result?: SimulationResult,
  comparison?: Partial<Comparison>,
  activeStrategy: StrategyId = 'proportional'
): string {
  const e = (key: string, values?: Record<string, string | number>) => t(`export.${key}`, values);
  const strategyName = (id: string) => t(`strategies.${id}`);

  const lines: string[] = [
    `# ${e('title')}`,
    `**${e('generated')}:** ${new Date().toISOString()} · **${e('provenance')}:** ${e('provenanceValue')}`,
    '',
    `## ${e('configuration')}`,
    `- **${e('scenario')}:** ${t(`scenarios.${input.scenarioId}.name`)} (${input.scenarioId})`,
    `- **${e('activeStrategy')}:** ${strategyName(activeStrategy)}`,
    `- **${e('resultId')}:** ${result?.id ?? e('notSimulated')}`,
    `- **${e('engineVersion')}:** ${result?.engineVersion ?? e('na')}`,
    `- **${e('pvPeak')}:** ${fmtKw(input.solar.peakKw, 1)}`,
    `- **${e('batteryCapacity')}:** ${fmtKwh(input.battery.capacityKwh, 1)} (${e('initialSoc', {
      pct: fmtPct(input.battery.initialSocPct, 0),
    })})`,
    `- **${e('demandMultiplier')}:** ${input.demandMultiplier.toFixed(2)}×`,
  ];

  const solarDrop = input.events.find((ev) => ev.type === 'solar_drop');
  if (solarDrop) {
    lines.push(
      `- **${e('solarDrop')}:** ${e('solarDropValue', {
        pct: Math.round((1 - solarDrop.factor) * 100),
        from: fmtHour(solarDrop.startHour),
        to: fmtHour(solarDrop.startHour + solarDrop.durationH),
      })}`
    );
  }

  if (result) {
    const m = result.metrics;
    const servedPct = m.demandKwh > 0 ? (m.servedKwh / m.demandKwh) * 100 : null;
    lines.push(
      '',
      `## ${e('keyMetrics')}`,
      `- **${e('totalDemand')}:** ${fmtKwh(m.demandKwh, 1)}`,
      `- **${e('servedEnergy')}:** ${fmtKwh(m.servedKwh, 1)} (${fmtPct(servedPct, 1)})`,
      `- **${e('unservedDeficit')}:** ${fmtKwh(m.unservedKwh, 1)}`,
      `- **${e('essentialCoverage')}:** ${fmtPct(m.criticalCoveragePct, 1)} (${e('unservedSuffix', {
        kwh: fmtKwh(m.criticalUnservedKwh, 1),
      })})`,
      `- **${e('criticalUnmetHours')}:** ${m.criticalUnmetHours} h`,
      `- **${e('endSoc')}:** ${fmtPct(m.socEndPct, 1)} (${e('minSoc', { pct: fmtPct(m.socMinPct, 1) })})`,
      `- **${e('curtailment')}:** ${fmtKwh(m.curtailedKwh, 1)}`,
      '',
      `## ${e('perSector')}`
    );

    for (const sec of input.sectors) {
      const sm = m.perSector[sec.id];
      if (sm) {
        lines.push(
          `- **${t(`sectors.${sec.id}`)}:** ${fmtKwh(sm.servedKwh, 1)} / ${fmtKwh(sm.demandKwh, 1)} (${e(
            'coverageSuffix',
            { pct: fmtPct(sm.coveragePct, 1) }
          )})`
        );
      }
    }

    lines.push('', `## ${e('warnings', { count: result.warnings.length })}`);
    if (result.warnings.length === 0) lines.push(`- ${e('noWarnings')}`);
    for (const w of result.warnings) {
      const sector = w.sector ? `${e('warningSector', { sector: t(`sectors.${w.sector}`) })} · ` : '';
      lines.push(`- [${w.code}] ${sector}${e('warningHours', { from: fmtHour(w.fromHour), to: fmtHour(w.toHour) })}`);
    }
  }

  if (comparison && Object.keys(comparison).length > 1) {
    lines.push('', `## ${e('strategyComparison')}`);
    for (const [strat, res] of Object.entries(comparison)) {
      if (res) {
        lines.push(
          `- **${strategyName(strat)}:** ${e('resultId')} ${res.id} | ${e('servedShort')}: ${fmtKwh(
            res.metrics.servedKwh,
            1
          )} | ${e('criticalCoverageShort')}: ${fmtPct(res.metrics.criticalCoveragePct, 1)} | ${e(
            'endSocShort'
          )}: ${fmtPct(res.metrics.socEndPct, 1)}`
        );
      }
    }
  }

  lines.push('', '---', `*${e('footer')}*`);
  return lines.join('\n');
}

/**
 * Triggers a browser download of a JSON object.
 */
export function downloadJsonFile(filename: string, data: unknown): void {
  if (typeof window === 'undefined') return;
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Copies a given text string to the system clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
