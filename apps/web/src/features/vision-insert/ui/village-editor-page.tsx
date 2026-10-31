'use client';

import { useRef, useState, type DragEvent } from 'react';
import { ImagePlus, ScanSearch, Sparkles } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { GridSchematicPreview } from '@/features/overview';
import { selectActiveResult, selectInput, selectTimeIndex, useSimulationStore } from '@/stores';
import { readAsDataUrl } from '@/lib/files';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useVisionSession } from '../hooks/use-vision-session';
import { DetectionCanvas } from './detection-canvas';
import { SelectedAppliance } from './selected-appliance';

/** Photos the vision route accepts. */
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const SAMPLE_ROOM_URL = '/samples/vision-room.jpg';

/**
 * /village — Village editor (PV): add a photo, see the objects found, pick one, next to the current village.
 * 3D editing and « Insert into simulation » come in V4.
 */
export function VillageEditorPage() {
  const t = useTranslations('features.visionInsert');
  const tCommon = useTranslations('common');
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [badType, setBadType] = useState(false);
  const [dragging, setDragging] = useState(false);
  const vision = useVisionSession(imageUrl);
  const input = useSimulationStore(selectInput);
  const result = useSimulationStore(selectActiveResult);
  const timeIndex = useSimulationStore(selectTimeIndex);
  const setTimeIndex = useSimulationStore((s) => s.setTimeIndex);

  const pickPhoto = async (file: Blob) => {
    if (!PHOTO_TYPES.includes(file.type)) {
      setBadType(true);
      return;
    }
    setBadType(false);
    const url = await readAsDataUrl(file);
    if (url) setImageUrl(url);
  };

  const loadSample = async () => {
    try {
      await pickPhoto(await (await fetch(SAMPLE_ROOM_URL)).blob());
    } catch {
      // Sample not reachable (offline build): the photo picker still works.
    }
  };

  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void pickPhoto(file);
  };

  const pickButton =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors cursor-pointer';

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-20 md:pb-6">
      <section className="flex flex-col items-start justify-between gap-3 rounded-card border border-border bg-surface-elevated/70 p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-control border border-energy-cyan/30 bg-energy-cyan/15 p-2 text-energy-cyan">
            <ScanSearch className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">{t('pageHeading')}</h2>
            <p className="text-sm text-text-secondary">{t('pageIntro')}</p>
          </div>
        </div>
        <StatusBadge variant="simulated" size="sm" label={tCommon('simulatedData')} />
      </section>

      <input
        ref={fileRef}
        type="file"
        accept={PHOTO_TYPES.join(',')}
        className="hidden"
        aria-label={t('choosePhoto')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void pickPhoto(file);
          e.target.value = '';
        }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          {!imageUrl ? (
            <section
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                'flex flex-col items-center gap-4 rounded-card border-2 border-dashed p-8 text-center transition-colors',
                dragging ? 'border-energy-cyan bg-energy-cyan/5' : 'border-border bg-surface'
              )}
            >
              <ImagePlus className="h-10 w-10 text-text-muted" aria-hidden="true" />
              <div>
                <p className="font-medium text-text-primary">{t('dropTitle')}</p>
                <p className="text-sm text-text-secondary">{t('dropHint')}</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    pickButton,
                    'bg-energy-cyan text-slate-950 hover:bg-energy-cyan/90'
                  )}
                >
                  <ImagePlus className="h-4 w-4" aria-hidden="true" />
                  {t('choosePhoto')}
                </button>
                <button
                  type="button"
                  onClick={() => void loadSample()}
                  className={cn(
                    pickButton,
                    'border border-border bg-surface-elevated text-text-primary hover:bg-surface-hover'
                  )}
                >
                  {t('useSample')}
                </button>
              </div>
              {badType && (
                <p role="alert" className="text-sm text-critical-red">
                  {t('badType')}
                </p>
              )}
            </section>
          ) : (
            <section className="rounded-card border border-border bg-surface p-4">
              <DetectionCanvas
                imageUrl={imageUrl}
                status={vision.status}
                detections={vision.detections}
                selectedId={vision.selectedId}
                onSelect={vision.select}
                onRetry={vision.retry}
                isDemo={vision.source === 'mock'}
              />
            </section>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {imageUrl && (
            <aside className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 text-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                {t('selectedTitle')}
              </h3>
              <div aria-live="polite">
                <SelectedAppliance selected={vision.selected} />
              </div>
              <p className="flex items-start gap-1.5 text-xs text-text-muted">
                <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-ai-violet" aria-hidden="true" />
                {t('nextStepNote')}
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn(
                  pickButton,
                  'border border-border bg-surface-elevated text-text-primary hover:bg-surface-hover'
                )}
              >
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                {t('changePhoto')}
              </button>
            </aside>
          )}
          {/* Current village state (store): where inserted appliances will show (V4). */}
          <GridSchematicPreview
            input={input}
            result={result}
            hour={timeIndex}
            onHourChange={setTimeIndex}
            stacked
          />
        </div>
      </div>
    </div>
  );
}
