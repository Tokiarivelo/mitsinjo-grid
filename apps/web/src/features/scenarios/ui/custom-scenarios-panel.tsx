'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Bot, Trash2, Download, Upload, CalendarRange, Layers } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { useSimulationStore } from '@/stores';
import { type ScenarioDraft, applyDraftDefaults, ScenarioDraftSchema } from '@/lib/scenario-draft';
import { WEATHER_VISUALS } from '@/features/simulation/utils/weather';
import { cn } from '@/lib/utils';
import { fmtKwh } from '@/lib/format';

export interface SavedDraftRow {
  id: string;
  title: string;
  draft: ScenarioDraft;
  summary?: {
    worstDay?: number;
    totalDeficitKwh?: number;
    criticalUnservedKwh?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export function CustomScenariosPanel() {
  const t = useTranslations('features.scenarios.custom');
  const tWeather = useTranslations('features.simulation.workflow.weather');
  const router = useRouter();

  const [drafts, setDrafts] = useState<SavedDraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDraftToStore = useSimulationStore((s) => s.loadDraft);

  const fetchDrafts = async () => {
    try {
      const res = await fetch('/api/scenarios/drafts');
      if (res.ok) {
        const data = await res.json();
        setDrafts(data.drafts || []);
      }
    } catch {
      // Offline / jsdom test fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch('/api/scenarios/drafts')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setDrafts(data.drafts || []);
        }
      })
      .catch(() => {
        // Offline / jsdom test fallback
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLaunch = (draft: ScenarioDraft, mode: 'manual' | 'autonomous') => {
    loadDraftToStore(draft, mode);
    router.push('/simulation');
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/scenarios/drafts?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDrafts((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (err) {
      console.error('[CustomScenariosPanel] Failed to delete draft:', err);
    }
  };

  const handleExport = (item: SavedDraftRow) => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(applyDraftDefaults(item.draft), null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `${item.title.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsedJson = JSON.parse(content);
        const parsed = ScenarioDraftSchema.safeParse(parsedJson);
        if (parsed.success) {
          const res = await fetch('/api/scenarios/drafts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: parsed.data.title || file.name.replace(/\.json$/, ''),
              draft: parsed.data,
            }),
          });
          if (res.ok) {
            fetchDrafts();
          }
        }
      } catch (err) {
        console.error('[CustomScenariosPanel] Import failed:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (loading && drafts.length === 0) {
    return null;
  }

  return (
    <div className="rounded-card border border-border bg-surface-elevated/70 p-5 shadow-xs backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-control border border-ai-violet/30 bg-ai-violet/15 text-ai-violet">
            <Layers className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-text-primary">{t('title')}</h3>
            <p className="text-xs text-text-muted">{t('description')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 min-h-11 px-3 py-1.5 text-xs font-sans font-medium rounded-control border border-border bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{t('importJson')}</span>
          </button>
        </div>
      </div>

      {drafts.length === 0 ? (
        <div className="py-8 text-center text-text-muted text-xs">
          <CalendarRange className="h-8 w-8 mx-auto mb-2 opacity-40 text-text-muted" />
          <p>{t('empty')}</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {drafts.map((item) => (
            <div
              key={item.id}
              className="rounded-control border border-border/70 bg-surface/80 p-3.5 flex flex-col justify-between gap-3 transition-colors hover:border-border"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-sans font-semibold text-xs text-text-primary truncate">
                    {item.title}
                  </h4>
                  <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded-control-sm bg-surface-elevated border border-border text-text-muted">
                    {t('daysCount', { count: item.draft.days.length })}
                  </span>
                </div>

                {/* Weather sequence preview */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.draft.days.map((d) => {
                    const visual = d.weather ? WEATHER_VISUALS[d.weather] : null;
                    const Icon = visual?.icon;
                    return (
                      <span
                        key={d.day}
                        title={t('dayWeather', {
                          day: d.day,
                          weather: tWeather(d.weather ?? 'sunny'),
                        })}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-control-sm bg-surface border border-border/60 text-[10px] font-mono text-text-secondary"
                      >
                        {Icon && <Icon className={cn('h-3 w-3', visual.tone)} />}
                        <span>{t('dayShort', { day: d.day })}</span>
                      </span>
                    );
                  })}
                </div>

                {/* Preview metrics if available */}
                {item.summary && (
                  <div className="mt-2.5 pt-2 border-t border-border/40 grid grid-cols-2 gap-1 text-[11px] font-mono text-text-secondary">
                    <div>
                      {t('deficit')}:{' '}
                      <span className="font-bold text-text-primary">
                        {fmtKwh(item.summary.totalDeficitKwh)}
                      </span>
                    </div>
                    <div>
                      {t('critical')}:{' '}
                      <span className="font-bold text-critical-red">
                        {fmtKwh(item.summary.criticalUnservedKwh)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleLaunch(item.draft, 'manual')}
                    title={t('launchManual')}
                    className="inline-flex items-center gap-1 min-h-11 px-2.5 py-1 text-xs font-semibold rounded-control bg-energy-cyan/20 border border-energy-cyan/40 text-energy-cyan hover:bg-energy-cyan/30 transition-colors cursor-pointer"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    <span>{t('launch')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLaunch(item.draft, 'autonomous')}
                    title={t('launchAutonomous')}
                    aria-label={t('launchAutonomous')}
                    className="inline-flex items-center gap-1 min-h-11 px-2.5 py-1 text-xs font-semibold rounded-control bg-ai-violet/20 border border-ai-violet/40 text-ai-violet hover:bg-ai-violet/30 transition-colors cursor-pointer"
                  >
                    <Bot className="h-3 w-3" />
                    <span>{t('ai')}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleExport(item)}
                    title={t('exportJson')}
                    aria-label={t('exportJson')}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-control text-text-muted hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    title={t('delete')}
                    aria-label={t('delete')}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-control text-text-muted hover:text-critical-red hover:bg-surface transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
