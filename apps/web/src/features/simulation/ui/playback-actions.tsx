'use client';

import { Pause, Play, RotateCcw, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';
import type { SimStatus } from '@/stores/simulation.store';
import { primaryPlaybackAction } from '../utils/playback';

export interface PlaybackActionsProps {
  status: SimStatus;
  isPlaying: boolean;
  hasResults: boolean;
  /** Blocks Run/Play and Restart (e.g. invalid inputs). Stop stays available. */
  disabled?: boolean;
  /** Run when needed, then play; pause while playing. */
  onTogglePlay: () => void;
  onStop: () => void;
  onRestart: () => void;
}

/** Stop · Restart · Run/Play/Pause — shared by the page header and the Controls tab. */
export function PlaybackActions({
  status,
  isPlaying,
  hasResults,
  disabled = false,
  onTogglePlay,
  onStop,
  onRestart,
}: PlaybackActionsProps) {
  const tSim = useTranslations('features.simulation');
  const tCommon = useTranslations('common');
  const action = primaryPlaybackAction(status, isPlaying, hasResults);

  const primary = {
    loading: { label: tCommon('loading'), aria: tCommon('loading') },
    pause: { label: tSim('pause'), aria: tSim('pausePlayback') },
    run: { label: tSim('runSimulation'), aria: tSim('runSimulation') },
    play: { label: tSim('play'), aria: tSim('startPlayback') },
  }[action];

  return (
    <>
      {hasResults && (
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={onStop}
            icon={<Square className="h-3 w-3 fill-current" aria-hidden="true" />}
            aria-label={tSim('stopPlayback')}
            title={tSim('stopPlayback')}
          >
            {tSim('stop')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onRestart}
            disabled={disabled}
            icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
            aria-label={tSim('restartPlayback')}
            title={tSim('restartPlayback')}
          >
            {tSim('restart')}
          </Button>
        </>
      )}
      <Button
        variant="primary"
        size="sm"
        loading={action === 'loading'}
        onClick={onTogglePlay}
        disabled={disabled}
        icon={
          isPlaying ? (
            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          )
        }
        aria-label={primary.aria}
      >
        {primary.label}
      </Button>
    </>
  );
}
