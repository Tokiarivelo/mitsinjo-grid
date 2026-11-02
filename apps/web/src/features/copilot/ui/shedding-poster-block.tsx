import { useState } from 'react';
import { Download } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import type { ActiveMedia } from './media-lightbox-modal';
import type { CopilotVisual } from '../types';
import { exportPosterPng } from '../utils/poster-export';

export interface SheddingPosterBlockProps {
  visual: CopilotVisual;
  onMediaClick?: (media: ActiveMedia) => void;
}

const padHour = (h: number) => String(h).padStart(2, '0');

/**
 * Load-shedding poster (M5-T3): the AI picture carries no numbers, the engine cut hours are an
 * HTML overlay, and Export PNG draws both onto a canvas for download.
 */
export function SheddingPosterBlock({ visual, onMediaClick }: SheddingPosterBlockProps) {
  const t = useTranslations('features.copilot');
  const tSectors = useTranslations('sectors');
  const [exported, setExported] = useState(false);
  const cuts = visual.overlay?.cuts ?? [];
  const title = t('posterTitle');
  const rows = cuts.map(
    (c) =>
      `${tSectors(c.sector)} · ${t('posterCutRange', { from: padHour(c.fromHour), to: padHour(c.toHour) })}`
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
          {rows.length === 0 ? (
            <p className="text-[11px] text-text-secondary">{t('posterNoCuts')}</p>
          ) : (
            <ul className="mt-0.5 max-h-24 overflow-y-auto text-[11px] text-text-secondary">
              {rows.map((row, i) => (
                <li key={`${cuts[i]?.sector}-${cuts[i]?.fromHour}`}>{row}</li>
              ))}
            </ul>
          )}
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
              `poster-${visual.resultId}.png`
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
