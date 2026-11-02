import { useState } from 'react';
import { Download } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import type { ActiveMedia } from './media-lightbox-modal';
import type { CopilotVisual, CopilotVisualPanel } from '../types';
import { exportPosterPng } from '../utils/poster-export';

export interface DayComicBlockProps {
  visual: CopilotVisual;
  onMediaClick?: (media: ActiveMedia) => void;
}

const padHour = (h: number) => String(h).padStart(2, '0');

const SKY_KEY: Record<CopilotVisualPanel['sky'], string> = {
  night: 'comicSkyNight',
  sunny: 'comicSkySunny',
  partly_cloudy: 'comicSkyPartly',
  overcast: 'comicSkyOvercast',
};

/**
 * Day comic (M12-T3): the AI strip carries no numbers, the engine panel hours and states are an
 * HTML overlay, and Export PNG draws both onto a canvas for download.
 */
export function DayComicBlock({ visual, onMediaClick }: DayComicBlockProps) {
  const t = useTranslations('features.copilot');
  const [exported, setExported] = useState(false);
  const panels = visual.overlay?.panels ?? [];
  const title = t('comicTitle');
  const rows = panels.map(
    (p) =>
      `${padHour(p.hour)}:00 · ${t(SKY_KEY[p.sky])} · ${t(p.cuts ? 'comicCuts' : 'comicNoCuts')}`
  );
  const alt = visual.caption || t('generatedImageAlt');

  const openLightbox = () =>
    onMediaClick?.({ url: visual.imageUrl, type: 'image', title: alt, caption: visual.caption });

  return (
    <div className="rounded-xl overflow-hidden border border-border/80 bg-surface shadow-sm">
      <div
        onClick={openLightbox}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') openLightbox();
        }}
        className="relative aspect-video w-full bg-surface-elevated/40 cursor-pointer group"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={visual.imageUrl}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-200"
          loading="lazy"
        />
        <div className="absolute top-2 right-2 flex gap-1">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-ai-violet/15 text-ai-violet backdrop-blur-sm border border-ai-violet/40 shadow-xs">
            {t('visualGeneratedBadge')}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-surface/90 backdrop-blur-sm border-t border-border/60 px-3 py-2">
          <p className="text-xs font-semibold text-text-primary">{title}</p>
          <ul className="mt-0.5 max-h-24 overflow-y-auto text-[11px] text-text-secondary">
            {rows.map((row, i) => (
              <li key={`${panels[i]?.hour}`}>{row}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 p-3 border-t border-border/60">
        <p className="text-[11px] text-text-muted font-sans min-w-0 truncate">
          {visual.caption || title}
        </p>
        <button
          type="button"
          onClick={async () => {
            const ok = await exportPosterPng(
              visual.imageUrl,
              [title, ...rows],
              `comic-${visual.resultId}.png`
            );
            setExported(ok);
          }}
          className="shrink-0 inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-control border border-border bg-surface-elevated text-xs font-medium text-text-primary hover:border-energy-cyan/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {t('posterExportPng')}
          {exported && <span aria-hidden="true">✓</span>}
        </button>
      </div>
    </div>
  );
}
