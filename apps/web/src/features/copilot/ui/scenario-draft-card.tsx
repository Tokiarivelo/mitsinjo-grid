'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarRange,
  Flame,
  TrendingUp,
  Sun,
  AlertTriangle,
  CheckCircle2,
  Play,
  Bot,
  Save,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtKwh } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { WEATHER_VISUALS } from '@/features/simulation/utils/weather';
import { useSimulationStore } from '@/stores';
import {
  type ScenarioDraft,
  type ScenarioDraftPayload,
  type MissingSlot,
  type MissingSlotOption,
  applyDraftDefaults,
  applySlotAnswer,
  missingSlots,
} from '@/lib/scenario-draft';

export interface ScenarioDraftCardProps {
  payload: ScenarioDraftPayload;
  onUpdateDraft?: (updatedDraft: ScenarioDraft) => void;
  className?: string;
}

export function ScenarioDraftCard({ payload, onUpdateDraft, className }: ScenarioDraftCardProps) {
  const t = useTranslations('features.copilot.scenarioDraft');
  const tWeather = useTranslations('features.simulation.workflow.weather');
  const tSectors = useTranslations('sectors');
  const router = useRouter();

  const [draft, setDraft] = useState<ScenarioDraft>(payload.draft);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadDraftToStore = useSimulationStore((s) => s.loadDraft);

  // Slots follow the local draft so a pill answer clears its warning at once.
  const slots = useMemo(() => missingSlots(draft), [draft]);
  const isComplete = slots.length === 0;
  // The engine preview belongs to the drafted version only; a local edit invalidates it.
  const preview = draft === payload.draft ? payload.preview : undefined;

  const optionLabel = (slot: MissingSlot, opt: MissingSlotOption): string => {
    const value = String(opt.value);
    switch (slot.kind) {
      case 'missing_weather':
      case 'duplicate_weather':
        return tWeather(value);
      case 'missing_fire_sector':
      case 'missing_spike_sector':
        return value === 'all' ? t('all') : tSectors(value);
      case 'day_out_of_bounds':
        return t('dayLabel', { day: value });
      default:
        return opt.label;
    }
  };

  const handleApplySlotAnswer = (slot: MissingSlot, value: string | number) => {
    const nextDraft = applySlotAnswer(draft, slot, value);
    setDraft(nextDraft);
    onUpdateDraft?.(nextDraft);
  };

  const handleLaunch = (mode: 'manual' | 'autonomous') => {
    loadDraftToStore(draft, mode);
    router.push('/simulation');
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/scenarios/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title || t('title', { days: draft.days.length }),
          draft,
          summary: preview,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('[ScenarioDraftCard] Failed to save draft:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(applyDraftDefaults(draft), null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `scenario-draft-${draft.days.length}days.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div
      className={cn(
        'rounded-card border bg-surface-elevated/80 p-4 shadow-sm backdrop-blur-sm transition-all',
        isComplete ? 'border-energy-cyan/40' : 'border-solar-amber/40',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-control border text-xs',
              isComplete
                ? 'border-energy-cyan/30 bg-energy-cyan/15 text-energy-cyan'
                : 'border-solar-amber/30 bg-solar-amber/15 text-solar-amber'
            )}
          >
            <CalendarRange className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h4 className="font-display text-sm font-semibold text-text-primary">
              {draft.title || t('title', { days: draft.days.length })}
            </h4>
            <p className="text-[11px] text-text-muted">
              {isComplete ? t('statusComplete') : t('statusIncomplete', { count: slots.length })}
            </p>
          </div>
        </div>

        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-medium',
            isComplete ? 'bg-energy-cyan/15 text-energy-cyan' : 'bg-solar-amber/15 text-solar-amber'
          )}
        >
          {isComplete ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              <span>{t('ready')}</span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-3 w-3" />
              <span>{t('refining')}</span>
            </>
          )}
        </span>
      </div>

      {/* Days sequence */}
      <div className="mt-3 space-y-2.5">
        {draft.days.map((d) => {
          const weatherVisual = d.weather ? WEATHER_VISUALS[d.weather] : null;
          const WeatherIcon = weatherVisual?.icon;
          const dayMissingSlots = slots.filter((s) => s.day === d.day);

          return (
            <div
              key={d.day}
              className={cn(
                'rounded-control border bg-surface/70 p-2.5 transition-colors',
                dayMissingSlots.length > 0
                  ? 'border-solar-amber/40 bg-solar-amber/5'
                  : 'border-border/60'
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Day & Weather */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-text-primary">
                    {t('dayLabel', { day: d.day })}
                  </span>
                  {d.weather && WeatherIcon && (
                    <span className="inline-flex items-center gap-1 rounded-control-sm border border-border/80 bg-surface px-2 py-0.5 text-xs text-text-secondary">
                      <WeatherIcon className={cn('h-3.5 w-3.5', weatherVisual.tone)} />
                      <span>{tWeather(d.weather)}</span>
                    </span>
                  )}
                  {!d.weather && (
                    <span className="inline-flex items-center gap-1 rounded-control-sm border border-solar-amber/50 bg-solar-amber/10 px-2 py-0.5 text-[11px] text-solar-amber font-mono">
                      {t('missingWeatherLabel')}
                    </span>
                  )}
                </div>

                {/* Events count */}
                {d.events && d.events.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {d.events.map((ev, eIdx) => {
                      if (ev.type === 'fire') {
                        return (
                          <span
                            key={eIdx}
                            className="inline-flex items-center gap-1 rounded-control-sm border border-critical-red/40 bg-critical-red/10 px-2 py-0.5 text-[11px] font-mono text-critical-red"
                          >
                            <Flame className="h-3 w-3" />
                            <span>
                              {ev.sector ? tSectors(ev.sector) : t('missingSector')}
                              {ev.startHour !== undefined
                                ? ` @ ${ev.startHour}h`
                                : ` (${t('missingHour')})`}
                            </span>
                          </span>
                        );
                      }
                      if (ev.type === 'demand_spike') {
                        return (
                          <span
                            key={eIdx}
                            className="inline-flex items-center gap-1 rounded-control-sm border border-warning-amber/40 bg-warning-amber/10 px-2 py-0.5 text-[11px] font-mono text-warning-amber"
                          >
                            <TrendingUp className="h-3 w-3" />
                            <span>
                              {ev.sector ? tSectors(ev.sector) : t('all')}
                              {ev.factor ? ` ×${ev.factor}` : ''}
                            </span>
                          </span>
                        );
                      }
                      if (ev.type === 'solar_drop') {
                        return (
                          <span
                            key={eIdx}
                            className="inline-flex items-center gap-1 rounded-control-sm border border-solar-amber/40 bg-solar-amber/10 px-2 py-0.5 text-[11px] font-mono text-solar-amber"
                          >
                            <Sun className="h-3 w-3" />
                            <span>{ev.dropPct ? `-${ev.dropPct}%` : t('drop')}</span>
                          </span>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}
              </div>

              {/* Day Missing Slots Pills */}
              {dayMissingSlots.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-solar-amber/20">
                  {dayMissingSlots.map((slot, sIdx) => (
                    <div key={sIdx} className="space-y-1.5">
                      <div className="text-[11px] font-medium text-solar-amber flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>{t(slot.messageKey)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {slot.suggestedResponses.map((opt, oIdx) => (
                          <button
                            key={oIdx}
                            type="button"
                            onClick={() => handleApplySlotAnswer(slot, opt.value)}
                            className="inline-flex items-center min-h-11 px-2.5 py-1 text-xs font-mono font-medium rounded-control border border-solar-amber/40 bg-surface hover:bg-solar-amber/20 hover:border-solar-amber text-text-primary transition-colors cursor-pointer"
                          >
                            {optionLabel(slot, opt)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Engine Computed Preview (when complete) */}
      {isComplete && preview && (
        <div className="mt-4 rounded-control border border-energy-cyan/30 bg-energy-cyan/5 p-3">
          <div className="text-xs font-mono font-semibold uppercase tracking-wider text-energy-cyan flex items-center justify-between">
            <span>{t('previewTitle')}</span>
            <span className="text-[10px] text-text-muted">
              {t('worstDayLabel', { day: preview.worstDay })}
            </span>
          </div>

          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
            <div className="rounded-control bg-surface/80 p-2 border border-border/50">
              <div className="text-[10px] text-text-muted">{t('totalDeficit')}</div>
              <div className="text-sm font-mono font-bold text-text-primary">
                {fmtKwh(preview.totalDeficitKwh)}
              </div>
            </div>
            <div className="rounded-control bg-surface/80 p-2 border border-border/50">
              <div className="text-[10px] text-text-muted">{t('criticalUnserved')}</div>
              <div className="text-sm font-mono font-bold text-critical-red">
                {fmtKwh(preview.criticalUnservedKwh)}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-control bg-surface/80 p-2 border border-border/50">
              <div className="text-[10px] text-text-muted">{t('worstDay')}</div>
              <div className="text-sm font-mono font-bold text-solar-amber">
                {t('dayLabel', { day: preview.worstDay })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {isComplete && (
            <>
              <button
                type="button"
                onClick={() => handleLaunch('manual')}
                className="inline-flex items-center gap-1.5 min-h-11 px-3.5 py-2 rounded-control bg-energy-cyan text-slate-950 font-sans font-semibold text-xs hover:bg-energy-cyan/90 transition-all cursor-pointer shadow-xs"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>{t('launchManual')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleLaunch('autonomous')}
                className="inline-flex items-center gap-1.5 min-h-11 px-3.5 py-2 rounded-control bg-ai-violet text-white font-sans font-semibold text-xs hover:bg-ai-violet/90 transition-all cursor-pointer shadow-xs"
              >
                <Bot className="h-4 w-4" />
                <span>{t('launchAutonomous')}</span>
              </button>
            </>
          )}

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveDraft}
            className="inline-flex items-center gap-1.5 min-h-11 px-3 py-2 rounded-control border border-border bg-surface hover:bg-surface-hover text-text-primary font-sans font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isSaving ? t('saving') : saveSuccess ? t('saved') : t('saveDraft')}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleExportJson}
          title={t('exportJson')}
          aria-label={t('exportJson')}
          className="inline-flex items-center gap-1 min-h-11 px-2.5 py-2 rounded-control border border-border/60 text-text-muted hover:text-text-primary hover:bg-surface text-xs transition-colors cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline font-mono">JSON</span>
        </button>
      </div>
    </div>
  );
}
