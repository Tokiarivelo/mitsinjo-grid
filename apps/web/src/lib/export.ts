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

/**
 * Generates a human-readable Markdown summary report for clipboard export.
 */
export function generateSummaryMarkdown(
  input: SimulationInput,
  result?: SimulationResult,
  comparison?: Partial<Comparison>,
  activeStrategy: StrategyId = 'proportional'
): string {
  const lines: string[] = [
    '# Mitsinjo Grid — Simulation Summary',
    `**Generated:** ${new Date().toISOString()} · **Data Provenance:** SYNTHETIC SIMULATION`,
    '',
    '## Configuration',
    `- **Scenario:** ${input.scenarioId}`,
    `- **Active Strategy:** ${activeStrategy}`,
    `- **Result ID:** ${result?.id ?? 'N/A (Not simulated)'}`,
    `- **Engine Version:** ${result?.engineVersion ?? 'N/A'}`,
    `- **PV Peak:** ${fmtKw(input.solar.peakKw, 1)}`,
    `- **Battery Capacity:** ${fmtKwh(input.battery.capacityKwh, 1)} (Initial SoC: ${fmtPct(input.battery.initialSocPct, 0)})`,
    `- **Demand Multiplier:** ${input.demandMultiplier.toFixed(2)}x`,
  ];

  const solarDrop = input.events.find((e) => e.type === 'solar_drop');
  if (solarDrop && solarDrop.type === 'solar_drop') {
    const dropPct = Math.round((1 - solarDrop.factor) * 100);
    lines.push(
      `- **Solar Drop Event:** -${dropPct}% from ${fmtHour(solarDrop.startHour)} to ${fmtHour(
        solarDrop.startHour + solarDrop.durationH
      )}`
    );
  }

  if (result) {
    const m = result.metrics;
    lines.push(
      '',
      '## Key Performance Metrics',
      `- **Total Demand:** ${fmtKwh(m.demandKwh, 1)}`,
      `- **Served Energy:** ${fmtKwh(m.servedKwh, 1)} (${fmtPct(m.demandKwh > 0 ? (m.servedKwh / m.demandKwh) * 100 : null, 1)})`,
      `- **Unserved Deficit:** ${fmtKwh(m.unservedKwh, 1)}`,
      `- **Essential Services Coverage:** ${fmtPct(m.criticalCoveragePct, 1)} (${fmtKwh(
        m.criticalUnservedKwh,
        1
      )} unserved)`,
      `- **Critical Unmet Hours:** ${m.criticalUnmetHours} h`,
      `- **Ending Battery SoC:** ${fmtPct(m.socEndPct, 1)} (Min: ${fmtPct(m.socMinPct, 1)})`,
      `- **Solar Curtailment:** ${fmtKwh(m.curtailedKwh, 1)}`,
      '',
      '## Per-Sector Service Allocation'
    );

    const sectorsOrder = ['health', 'water', 'school', 'households', 'market'] as const;
    for (const sec of sectorsOrder) {
      const sm = m.perSector[sec];
      if (sm) {
        lines.push(
          `- **${sec.charAt(0).toUpperCase() + sec.slice(1)}:** ${fmtKwh(sm.servedKwh, 1)} / ${fmtKwh(
            sm.demandKwh,
            1
          )} (${fmtPct(sm.coveragePct, 1)} coverage)`
        );
      }
    }

    if (result.warnings.length > 0) {
      lines.push('', `## Active Warnings (${result.warnings.length})`);
      for (const w of result.warnings) {
        lines.push(`- [${w.code}] ${w.sector ? `Sector: ${w.sector} · ` : ''}Hours ${w.fromHour}-${w.toHour}`);
      }
    } else {
      lines.push('', '## Active Warnings', '- None (Nominal operating conditions)');
    }
  }

  if (comparison && Object.keys(comparison).length > 1) {
    lines.push('', '## Strategy Comparison');
    for (const [strat, res] of Object.entries(comparison)) {
      if (res) {
        lines.push(
          `- **${strat}:** Result ID ${res.id} | Served: ${fmtKwh(
            res.metrics.servedKwh,
            1
          )} | Critical Coverage: ${fmtPct(res.metrics.criticalCoveragePct, 1)} | End SoC: ${fmtPct(
            res.metrics.socEndPct,
            1
          )}`
        );
      }
    }
  }

  lines.push('', '---', '*Simulated data generated by @mitsinjo/engine. Not measured from a live village.*');
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
