'use client';

import { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileCheck,
} from 'lucide-react';
import type {
  Comparison,
  SimulationInput,
  SimulationResult,
  StrategyId,
} from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { fmtKwh, fmtPct } from '@/lib/format';
import {
  buildExportData,
  copyToClipboard,
  downloadJsonFile,
  generateSummaryMarkdown,
} from '@/lib/export';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';

export interface ReproducibilitySummaryProps {
  input: SimulationInput;
  result?: SimulationResult;
  comparison?: Partial<Comparison>;
  activeStrategy: StrategyId;
  className?: string;
}

export function ReproducibilitySummary({
  input,
  result,
  comparison,
  activeStrategy,
  className,
}: ReproducibilitySummaryProps) {
  const tScenarios = useTranslations('features.scenarios');
  const tActions = useTranslations('actions');
  const [copied, setCopied] = useState(false);

  const handleCopySummary = async () => {
    const md = generateSummaryMarkdown(input, result, comparison, activeStrategy);
    const success = await copyToClipboard(md);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadJson = () => {
    const exportData = buildExportData(input, result, comparison, activeStrategy);
    const filename = `mitsinjo-${input.scenarioId}-${activeStrategy}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    downloadJsonFile(filename, exportData);
  };

  const metrics = result?.metrics;

  return (
    <div
      className={cn(
        'flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-card bg-surface border border-border shadow-sm',
        className
      )}
    >
      {/* Left: Summary Telemetry Pills */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-energy-cyan" aria-hidden="true" />
          <h4 className="text-xs font-display font-semibold uppercase tracking-wider text-text-primary">
            {tScenarios('latestRunSummary')}
          </h4>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-control-sm bg-surface-elevated border border-border text-energy-cyan">
            {result ? result.id : tScenarios('notRunYet')}
          </span>
        </div>

        {metrics ? (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
            <span className="text-text-muted">
              {tScenarios('demand')}:{' '}
              <strong className="text-text-primary">{fmtKwh(metrics.demandKwh)}</strong>
            </span>
            <span className="text-text-muted">·</span>
            <span className="text-text-muted">
              {tScenarios('served')}:{' '}
              <strong className="text-battery-green">{fmtKwh(metrics.servedKwh)}</strong>
            </span>
            <span className="text-text-muted">·</span>
            <span className="text-text-muted">
              {tScenarios('unserved')}:{' '}
              <strong
                className={metrics.unservedKwh > 0 ? 'text-critical-red' : 'text-text-muted'}
              >
                {fmtKwh(metrics.unservedKwh)}
              </strong>
            </span>
            <span className="text-text-muted">·</span>
            <span className="text-text-muted">
              {tScenarios('essentialCoverage')}:{' '}
              <strong
                className={
                  metrics.criticalCoveragePct < 99 ? 'text-solar-amber' : 'text-battery-green'
                }
              >
                {fmtPct(metrics.criticalCoveragePct)}
              </strong>
            </span>
            <span className="text-text-muted">·</span>
            <span className="text-text-muted">
              {tScenarios('endSoc')}:{' '}
              <strong className="text-text-primary">{fmtPct(metrics.socEndPct)}</strong>
            </span>
          </div>
        ) : (
          <p className="text-xs text-text-muted font-sans">
            {tScenarios('runToGenerateSummary')}
          </p>
        )}
      </div>

      {/* Right: Export CTAs */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopySummary}
          icon={
            copied ? (
              <Check className="h-3.5 w-3.5 text-battery-green" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )
          }
          aria-label={tActions('copySummary')}
        >
          {copied ? tActions('copied') : tActions('copySummary')}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleDownloadJson}
          icon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
          aria-label={tActions('downloadJson')}
        >
          {tActions('downloadJson')}
        </Button>
      </div>
    </div>
  );
}
