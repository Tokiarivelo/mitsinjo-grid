'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ClipboardCheck,
  FileCode,
  FileSpreadsheet,
  Filter,
  Flame,
  HelpCircle,
  Info,
  ScrollText,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import { type DispatchLogEntry, type IncidentSeverity, SECTOR_IDS } from '@mitsinjo/engine';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { SectorIcon } from '@/components/ui/sector-icon';
import { useTranslations } from '@/lib/i18n';
import { fmtHour, fmtEvidence, fmtKwh, fmtPct } from '@/lib/format';
import {
  computeShiftReport,
  dispatchLogToCsv,
  entrySavedKwh,
  entrySector,
} from '@/lib/dispatch-log';
import { downloadJsonFile, downloadTextFile } from '@/lib/export';
import { fillCopilotPrompt } from '@/lib/copilot-fill';
import { cn } from '@/lib/utils';
import { useSimulationStore } from '@/stores';
import { ShiftReportDialog } from './shift-report-dialog';

export interface DispatchLogPanelProps {
  compact?: boolean;
  className?: string;
  onSelectEntry?: (entry: DispatchLogEntry) => void;
  onAskWhy?: (entry: DispatchLogEntry) => void;
  onAskCopilot?: (prompt: string) => void;
}

type SeverityFilter = 'all' | IncidentSeverity;
type TypeFilter = 'all' | 'incident' | 'action';

const TYPE_FILTERS = [
  { id: 'all', labelKey: 'filterAll' },
  { id: 'incident', labelKey: 'filterIncidents' },
  { id: 'action', labelKey: 'filterActions' },
] as const satisfies readonly { id: TypeFilter; labelKey: string }[];

const SEVERITY_LABEL_KEY = {
  critical: 'filterCritical',
  warning: 'filterWarning',
  info: 'filterInfo',
} as const satisfies Record<IncidentSeverity, string>;

const SEVERITY_FILTERS = [
  { id: 'all', labelKey: 'filterAll' },
  ...(['critical', 'warning', 'info'] as const).map((id) => ({
    id,
    labelKey: SEVERITY_LABEL_KEY[id],
  })),
] as const satisfies readonly { id: SeverityFilter; labelKey: string }[];

const FILTER_BTN =
  'px-2 min-h-[32px] rounded-xs text-[11px] font-sans font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-energy-cyan';
const FILTER_BTN_ON = 'bg-surface-elevated text-text-primary font-semibold shadow-xs';
const FILTER_BTN_OFF = 'text-text-muted hover:text-text-primary';

export function DispatchLogPanel({
  compact = false,
  className,
  onSelectEntry,
  onAskWhy,
  onAskCopilot,
}: DispatchLogPanelProps) {
  const t = useTranslations('features.dispatch');
  const tCommon = useTranslations('common');
  const tSectors = useTranslations('sectors');

  const dispatchLog = useSimulationStore((s) => s.dispatchLog);
  const setTimeIndex = useSimulationStore((s) => s.setTimeIndex);
  const setDayIndex = useSimulationStore((s) => s.setDayIndex);
  const selectSector = useSimulationStore((s) => s.selectSector);
  const dayIndex = useSimulationStore((s) => s.dayIndex);

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [showShiftReport, setShowShiftReport] = useState(false);

  const shiftReport = useMemo(
    () => computeShiftReport(dispatchLog, dayIndex),
    [dispatchLog, dayIndex]
  );

  const filteredEntries = useMemo(() => {
    return dispatchLog.filter((entry) => {
      // Severity filter
      if (severityFilter !== 'all') {
        const sev = entry.incident?.severity ?? (entry.action ? 'info' : null);
        if (sev !== severityFilter) return false;
      }

      // Type filter
      if (typeFilter === 'incident' && !entry.incident) return false;
      if (typeFilter === 'action' && !entry.action) return false;

      // Sector filter
      if (sectorFilter !== 'all' && entrySector(entry) !== sectorFilter) return false;

      return true;
    });
  }, [dispatchLog, severityFilter, typeFilter, sectorFilter]);

  const handleEntryClick = (entry: DispatchLogEntry) => {
    setTimeIndex(entry.hour);
    setDayIndex(entry.day);
    const targetSector = entrySector(entry);
    if (targetSector) {
      selectSector(targetSector);
    }
    onSelectEntry?.(entry);
  };

  const handleAskWhy = (entry: DispatchLogEntry) => {
    handleEntryClick(entry);
    onAskWhy?.(entry);
  };

  const fileStem = () => `mitsinjo-dispatch-log-${Date.now()}`;
  const handleExportJson = () => downloadJsonFile(`${fileStem()}.json`, dispatchLog);
  const handleExportCsv = () =>
    downloadTextFile(`${fileStem()}.csv`, dispatchLogToCsv(dispatchLog), 'text/csv');

  return (
    <div
      className={cn(
        'flex flex-col rounded-card border border-border bg-surface shadow-xs overflow-hidden',
        className
      )}
      data-testid="dispatch-log-panel"
    >
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 sm:px-4 border-b border-border bg-surface-elevated/40">
        <div className="flex items-center gap-2 min-w-0">
          <ScrollText className="h-4 w-4 text-ai-violet shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-display font-semibold text-text-primary tracking-tight truncate">
            {t('eventLog')}
          </h2>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-surface border border-border text-text-muted shrink-0">
            {filteredEntries.length}/{dispatchLog.length}
          </span>
          <StatusBadge variant="simulated" size="sm" />
        </div>

        {/* Export action buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportJson}
            disabled={dispatchLog.length === 0}
            aria-label={t('downloadJson')}
            title={t('downloadJson')}
            icon={<FileCode className="h-3 w-3" aria-hidden="true" />}
            className="text-[11px] h-7 px-2 font-mono shrink-0"
          >
            {t('exportJson')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            disabled={dispatchLog.length === 0}
            aria-label={t('downloadCsv')}
            title={t('downloadCsv')}
            icon={<FileSpreadsheet className="h-3 w-3" aria-hidden="true" />}
            className="text-[11px] h-7 px-2 font-mono shrink-0"
          >
            {t('exportCsv')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowShiftReport(true)}
            disabled={dispatchLog.length === 0}
            aria-label={t('shiftReport')}
            title={t('shiftReport')}
            icon={<ClipboardCheck className="h-3 w-3 text-energy-cyan" aria-hidden="true" />}
            className="text-[11px] h-7 px-2.5 font-sans whitespace-nowrap shrink-0 border-energy-cyan/40 hover:bg-energy-cyan/10"
            data-testid="shift-report-button"
          >
            {t('shiftReport')}
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      {!compact && (
        <div className="p-2 sm:px-4 border-b border-border bg-canvas-sunken/40 flex flex-wrap items-center gap-2.5 text-xs">
          <span className="flex items-center gap-1 text-[11px] font-mono text-text-muted uppercase tracking-wider">
            <Filter className="h-3 w-3" aria-hidden="true" />
          </span>

          {/* Type filter */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono uppercase text-text-muted">
              {t('filterType')}:
            </span>
            <div
              role="group"
              aria-label={t('filterType')}
              className="flex items-center gap-0.5 rounded-control-sm bg-surface border border-border p-0.5"
            >
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={typeFilter === f.id}
                  onClick={() => setTypeFilter(f.id)}
                  className={cn(FILTER_BTN, typeFilter === f.id ? FILTER_BTN_ON : FILTER_BTN_OFF)}
                >
                  {f.id === 'all' ? t('filterAllTypes') : t(f.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Severity filter */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono uppercase text-text-muted">
              {t('filterSeverity')}:
            </span>
            <div
              role="group"
              aria-label={t('filterSeverity')}
              className="flex items-center gap-0.5 rounded-control-sm bg-surface border border-border p-0.5"
            >
              {SEVERITY_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={severityFilter === f.id}
                  onClick={() => setSeverityFilter(f.id)}
                  className={cn(
                    FILTER_BTN,
                    severityFilter === f.id ? FILTER_BTN_ON : FILTER_BTN_OFF
                  )}
                >
                  {f.id === 'all' ? t('filterAllSeverities') : t(f.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Sector filter */}
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            aria-label={t('filterSector')}
            className="min-h-[32px] px-1.5 rounded-xs bg-surface border border-border text-[11px] font-sans text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-energy-cyan cursor-pointer"
          >
            <option value="all">{t('allSectors')}</option>
            {SECTOR_IDS.map((sId) => (
              <option key={sId} value={sId}>
                {tSectors(sId)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/60 max-h-[480px]">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center gap-1.5">
            <ScrollText className="h-8 w-8 text-text-muted/60" aria-hidden="true" />
            <p className="text-xs font-semibold text-text-secondary">{t('emptyLog')}</p>
            <p className="text-[11px] text-text-muted max-w-xs">{t('emptyLogHint')}</p>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isIncident = Boolean(entry.incident);
            const isAction = Boolean(entry.action);
            const sector = entrySector(entry);
            const severity = entry.incident?.severity ?? 'info';
            const savedKwh = entrySavedKwh(entry);

            return (
              <div
                key={entry.id}
                data-testid={`dispatch-entry-${entry.id}`}
                onClick={() => handleEntryClick(entry)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleEntryClick(entry);
                  }
                }}
                className={cn(
                  'p-3 flex flex-col gap-2 hover:bg-surface-hover/50 transition-colors cursor-pointer text-left',
                  'focus-visible:outline-none focus-visible:bg-surface-hover focus-visible:ring-1 focus-visible:ring-energy-cyan'
                )}
              >
                {/* Entry Top Row: Time, Mode/Origin, Severity, Kind */}
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {/* Timestamp */}
                    <span className="font-mono text-xs font-bold text-text-primary bg-surface-elevated border border-border px-1.5 py-0.5 rounded">
                      {fmtHour(entry.hour)}
                    </span>

                    {/* Origin Badge */}
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase border',
                        entry.origin === 'ai'
                          ? 'bg-ai-violet/15 text-ai-violet border-ai-violet/30'
                          : 'bg-surface text-text-secondary border-border'
                      )}
                    >
                      {entry.origin === 'ai' && (
                        <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                      )}
                      <span>{entry.origin === 'ai' ? t('originAi') : t('originOperator')}</span>
                    </span>

                    {/* Severity Indicator */}
                    {isIncident && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase',
                          severity === 'critical'
                            ? 'bg-critical-red/20 text-critical-red border border-critical-red/40'
                            : severity === 'warning'
                              ? 'bg-warning-amber/20 text-warning-amber border border-warning-amber/40'
                              : 'bg-energy-cyan/20 text-energy-cyan border border-energy-cyan/40'
                        )}
                      >
                        {severity === 'critical' ? (
                          <Flame
                            className="h-2.5 w-2.5 motion-safe:animate-pulse"
                            aria-hidden="true"
                          />
                        ) : severity === 'warning' ? (
                          <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
                        ) : (
                          <Info className="h-2.5 w-2.5" aria-hidden="true" />
                        )}
                        <span>{t(SEVERITY_LABEL_KEY[severity])}</span>
                      </span>
                    )}

                    {/* Sector icon & name */}
                    {sector && (
                      <div className="flex items-center gap-1 text-xs text-text-primary font-medium">
                        <SectorIcon sector={sector} className="h-3 w-3 text-text-muted" />
                        <span>{tSectors(sector)}</span>
                      </div>
                    )}
                  </div>

                  {/* Hash for reproducibility/audit */}
                  <span className="font-mono text-[9px] text-text-muted/70 tracking-wider">
                    #{entry.hash.slice(0, 8)}
                  </span>
                </div>

                {/* Event Title / Description */}
                <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  {isAction ? (
                    <Zap className="h-3.5 w-3.5 text-solar-amber shrink-0" aria-hidden="true" />
                  ) : (
                    <ShieldAlert
                      className="h-3.5 w-3.5 text-critical-red shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span>
                    {isAction && entry.action
                      ? t(`actions.${entry.action.kind}` as never)
                      : isIncident && entry.incident
                        ? t(`incidents.${entry.incident.kind}` as never)
                        : ''}
                  </span>
                </div>

                {/* Visual Distinction: AI Text Callout */}
                {(entry.narration || isAction) && (
                  <div className="rounded-control-sm border border-ai-violet/30 bg-ai-violet/5 p-2 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-ai-violet" aria-hidden="true" />
                        <span className="text-[9px] font-mono uppercase tracking-wider font-semibold text-ai-violet">
                          {tCommon('aiGenerated')}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 min-h-[36px] sm:min-h-[24px] px-2 text-[10px] font-medium text-ai-violet hover:bg-ai-violet/15 hover:text-ai-violet rounded border border-ai-violet/30 flex items-center gap-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAskWhy(entry);
                        }}
                        data-testid={`why-button-${entry.id}`}
                      >
                        <HelpCircle className="h-3 w-3" aria-hidden="true" />
                        <span>{t('askWhy')}</span>
                      </Button>
                    </div>
                    <p className="text-xs text-text-primary italic leading-relaxed">
                      {entry.narration?.text ??
                        (entry.action
                          ? t('reasonTemplate', {
                              action: t(`actions.${entry.action.kind}` as never),
                              sector: sector ? tSectors(sector) : '',
                              hour: entry.hour,
                              reason: entry.action.answers ?? entry.origin,
                            })
                          : '')}
                    </p>
                  </div>
                )}

                {/* Computed Metrics Box (Pure Telemetry, Monospace) */}
                {(entry.before && entry.after) ||
                (entry.incident && Object.keys(entry.incident.evidence).length > 0) ? (
                  <div className="rounded-control-sm border border-border/70 bg-canvas-sunken/60 p-2 flex flex-col gap-1.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-[10px] text-text-muted uppercase tracking-wider">
                      <span>{entry.before ? t('beforeAfter') : t('evidence')}</span>
                      {savedKwh > 0 && (
                        <span className="font-semibold text-battery-green">
                          {t('energySaved', { kwh: fmtKwh(savedKwh) })}
                        </span>
                      )}
                    </div>

                    {entry.before && entry.after ? (
                      <div className="grid grid-cols-2 gap-2 text-text-secondary">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-text-muted">{t('before')}</span>
                          <span>
                            {t('unserved')}: {fmtKwh(entry.before.unservedKwh)}
                          </span>
                          <span>
                            {t('soc')}: {fmtPct(entry.before.socEndPct, 0)}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-text-muted">{t('after')}</span>
                          <span
                            className={
                              entry.after.unservedKwh < entry.before.unservedKwh
                                ? 'text-battery-green font-semibold'
                                : ''
                            }
                          >
                            {t('unserved')}: {fmtKwh(entry.after.unservedKwh)}
                          </span>
                          <span>
                            {t('soc')}: {fmtPct(entry.after.socEndPct, 0)}
                          </span>
                        </div>
                      </div>
                    ) : entry.incident?.evidence ? (
                      <div className="flex flex-wrap gap-2 text-text-secondary">
                        {Object.entries(entry.incident.evidence).map(([key, val]) => (
                          <span
                            key={key}
                            className="bg-surface px-1.5 py-0.5 rounded border border-border text-[10px]"
                          >
                            {key}:{' '}
                            <span className="font-bold text-text-primary">{fmtEvidence(val)}</span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <ShiftReportDialog
        isOpen={showShiftReport}
        onClose={() => setShowShiftReport(false)}
        report={shiftReport}
        onAskCopilot={onAskCopilot ?? fillCopilotPrompt}
      />
    </div>
  );
}
