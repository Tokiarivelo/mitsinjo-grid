'use client';

import { useEffect, useState } from 'react';
import {
  X,
  ClipboardCheck,
  Flame,
  AlertTriangle,
  Info,
  ShieldCheck,
  Battery,
  Copy,
  Check,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectorIcon } from '@/components/ui/sector-icon';
import { useTranslations } from '@/lib/i18n';
import { fmtHour, fmtKwh, fmtPct } from '@/lib/format';
import type { ShiftReport } from '@/lib/dispatch-log';

export interface ShiftReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  report: ShiftReport;
  onAskCopilot?: (prompt: string) => void;
}

export function ShiftReportDialog({
  isOpen,
  onClose,
  report,
  onAskCopilot,
}: ShiftReportDialogProps) {
  const t = useTranslations('features.dispatch');
  const tSectors = useTranslations('sectors');
  const [copied, setCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = () => {
    const summaryText = [
      `=== ${t('shiftReportTitle', { day: report.day + 1 })} ===`,
      `- ${t('totalIncidents')}: ${report.totalIncidents} (${report.criticalIncidents} ${t('filterCritical')}, ${report.warningIncidents} ${t('filterWarning')})`,
      `- ${t('totalActions')}: ${report.totalActions}`,
      `- ${t('criticalSaved')}: ${fmtKwh(report.criticalSavedKwh)}`,
      `- ${t('energySavedTotal')}: ${fmtKwh(report.savedKwh)}`,
      report.finalSocPct !== undefined ? `- ${t('socEnd')}: ${fmtPct(report.finalSocPct, 0)}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(summaryText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleDiscuss = () => {
    onClose();
    onAskCopilot?.(
      t('discussPrompt', {
        day: report.day + 1,
        criticalKwh: fmtKwh(report.criticalSavedKwh),
        count: report.totalActions,
      })
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-report-title"
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-card border border-border bg-surface shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border bg-surface-elevated flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-control-sm bg-energy-cyan/15 text-energy-cyan border border-energy-cyan/30">
              <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="shift-report-title"
                className="text-sm sm:text-base font-bold text-text-primary"
              >
                {t('shiftReportTitle', { day: report.day + 1 })}
              </h2>
              <p className="text-xs text-text-muted">
                {t('shiftReportSubtitle', { count: report.totalActions })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-control text-text-muted hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex flex-col gap-5 text-sm">
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Incidents Card */}
            <div className="p-3 rounded-control-sm border border-border bg-surface-elevated/60 flex flex-col gap-1">
              <span className="text-[11px] font-medium text-text-muted">{t('totalIncidents')}</span>
              <span className="font-mono text-xl font-bold text-text-primary">
                {report.totalIncidents}
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-[10px] font-mono">
                {report.criticalIncidents > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-critical-red">
                    <Flame className="h-2.5 w-2.5" />
                    {report.criticalIncidents}
                  </span>
                )}
                {report.warningIncidents > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-warning-amber">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {report.warningIncidents}
                  </span>
                )}
                {report.infoIncidents > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-energy-cyan">
                    <Info className="h-2.5 w-2.5" />
                    {report.infoIncidents}
                  </span>
                )}
              </div>
            </div>

            {/* Actions Applied Card */}
            <div className="p-3 rounded-control-sm border border-border bg-surface-elevated/60 flex flex-col gap-1">
              <span className="text-[11px] font-medium text-text-muted">{t('totalActions')}</span>
              <span className="font-mono text-xl font-bold text-ai-violet">
                {report.totalActions}
              </span>
              <span className="text-[10px] text-text-secondary mt-1 flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5 text-ai-violet" />
                {t('autonomousDecisions')}
              </span>
            </div>

            {/* Critical Energy Saved */}
            <div className="p-3 rounded-control-sm border border-battery-green/30 bg-battery-green/5 flex flex-col gap-1">
              <span className="text-[11px] font-medium text-battery-green">
                {t('criticalSaved')}
              </span>
              <span className="font-mono text-xl font-bold text-battery-green">
                {fmtKwh(report.criticalSavedKwh)}
              </span>
              <span className="text-[10px] text-battery-green/80 mt-1 flex items-center gap-0.5">
                <ShieldCheck className="h-2.5 w-2.5" />
                {t('vitalServicesProtected')}
              </span>
            </div>

            {/* Battery End State */}
            <div className="p-3 rounded-control-sm border border-border bg-surface-elevated/60 flex flex-col gap-1">
              <span className="text-[11px] font-medium text-text-muted">{t('socEnd')}</span>
              <span className="font-mono text-xl font-bold text-text-primary">
                {report.finalSocPct !== undefined ? fmtPct(report.finalSocPct, 0) : '—'}
              </span>
              <span className="text-[10px] text-text-muted mt-1 flex items-center gap-1">
                <Battery className="h-2.5 w-2.5" />
                {report.minSocPct !== undefined
                  ? t('socMin', { pct: fmtPct(report.minSocPct, 0) })
                  : t('socStable')}
              </span>
            </div>
          </div>

          {/* Counterfactual Impact Banner */}
          <div className="p-3.5 rounded-control-sm border border-ai-violet/30 bg-ai-violet/5 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-ai-violet shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex flex-col gap-1 text-xs text-text-secondary leading-relaxed">
              <span className="font-semibold text-text-primary">{t('counterfactualTitle')}</span>
              <p>
                {t('counterfactualDescription', {
                  criticalKwh: fmtKwh(report.criticalSavedKwh),
                  totalKwh: fmtKwh(report.savedKwh),
                })}
              </p>
            </div>
          </div>

          {/* Key Interventions List */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-text-primary uppercase font-mono tracking-wider">
              {t('keyInterventions')}
            </span>
            {report.keyActions.length === 0 ? (
              <p className="text-xs text-text-muted italic py-3 text-center">
                {t('noKeyInterventions')}
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                {report.keyActions.map((action) => (
                  <div
                    key={action.id}
                    className="p-2.5 rounded-control-sm border border-border bg-surface-elevated/40 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] font-bold text-text-primary bg-surface px-1.5 py-0.5 rounded border border-border">
                        {fmtHour(action.hour)}
                      </span>
                      {action.sector && (
                        <div className="flex items-center gap-1 font-medium text-text-primary">
                          <SectorIcon sector={action.sector} className="h-3 w-3 text-text-muted" />
                          <span>{tSectors(action.sector)}</span>
                        </div>
                      )}
                      <span className="text-text-muted truncate">
                        {t(`actions.${action.actionKind}` as never)}
                      </span>
                    </div>

                    {action.savedKwh > 0 && (
                      <span className="font-mono text-[11px] font-bold text-battery-green shrink-0">
                        +{fmtKwh(action.savedKwh)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-surface-elevated flex flex-wrap items-center justify-between gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            icon={
              copied ? (
                <Check className="h-3.5 w-3.5 text-battery-green" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )
            }
            className="min-h-[44px] sm:min-h-[36px]"
          >
            {copied ? t('copied') : t('copySummary')}
          </Button>

          <div className="flex items-center gap-2">
            {onAskCopilot && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleDiscuss}
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                className="min-h-[44px] sm:min-h-[36px]"
              >
                {t('discussWithCopilot')}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="min-h-[44px] sm:min-h-[36px]"
            >
              {t('close')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
