'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Pause, Play, RotateCcw } from 'lucide-react';
import type { StepResult } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { fmtHour, fmtKw, fmtPct } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';

export interface TimelineScrubberProps {
  timeIndex: number;
  onTimeChange: (timeIndex: number) => void;
  stepResult?: StepResult | null;
  hasResults?: boolean;
  className?: string;
}

export function TimelineScrubber({
  timeIndex,
  onTimeChange,
  stepResult,
  hasResults = false,
  className,
}: TimelineScrubberProps) {
  const tSim = useTranslations('features.simulation');
  const [isPlaying, setIsPlaying] = useState(false);

  // Auto-advance loop when isPlaying is true
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      onTimeChange((timeIndex + 1) % 24);
    }, 750);

    return () => clearInterval(interval);
  }, [isPlaying, timeIndex, onTimeChange]);

  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handlePrev = () => {
    setIsPlaying(false);
    onTimeChange((timeIndex - 1 + 24) % 24);
  };

  const handleNext = () => {
    setIsPlaying(false);
    onTimeChange((timeIndex + 1) % 24);
  };

  const handleResetToNoon = () => {
    setIsPlaying(false);
    onTimeChange(12);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsPlaying(false);
    const nextVal = parseInt(e.target.value, 10);
    if (!isNaN(nextVal)) {
      onTimeChange(nextVal);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-4 rounded-card bg-surface border border-border shadow-sm',
        className
      )}
    >
      {/* Header: Title, Active Time badge, Playback Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-control-sm bg-energy-cyan/15 text-energy-cyan">
            <Clock className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-text-primary">
              {tSim('timelineTitle')}
            </h3>
            <p className="text-[11px] text-text-secondary">{tSim('timelineSubtitle')}</p>
          </div>
        </div>

        {/* Center/Right Playback Controls */}
        <div className="flex items-center gap-1.5 self-start sm:self-center">
          <button
            type="button"
            onClick={handlePrev}
            aria-label={tSim('stepBackward')}
            className="p-1.5 rounded-control text-text-secondary hover:text-text-primary hover:bg-surface-elevated border border-border transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? tSim('pausePlayback') : tSim('startPlayback')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-sans font-medium transition-colors cursor-pointer border',
              isPlaying
                ? 'bg-solar-amber/20 text-solar-amber border-solar-amber/40 shadow-xs'
                : 'bg-surface-elevated text-text-primary border-border hover:bg-surface-hover'
            )}
          >
            {isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{tSim('pause')}</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden="true" />
                <span>{tSim('play')}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleNext}
            aria-label={tSim('stepForward')}
            className="p-1.5 rounded-control text-text-secondary hover:text-text-primary hover:bg-surface-elevated border border-border transition-colors cursor-pointer"
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleResetToNoon}
            aria-label={tSim('resetToNoon')}
            title={tSim('resetToNoon')}
            className="p-1.5 rounded-control text-text-muted hover:text-text-primary hover:bg-surface-elevated border border-border transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          {/* Current Hour Pill */}
          <div className="ml-2 px-2.5 py-1 rounded-control bg-surface-elevated border border-energy-cyan/40 text-energy-cyan font-mono text-xs font-semibold">
            {fmtHour(timeIndex)}
          </div>
        </div>
      </div>

      {/* Slider & 24h Tick Marks */}
      <div className="flex flex-col gap-1.5 px-1 pt-1">
        <input
          type="range"
          min={0}
          max={23}
          step={1}
          value={timeIndex}
          onChange={handleSliderChange}
          aria-valuemin={0}
          aria-valuemax={23}
          aria-valuenow={timeIndex}
          aria-valuetext={fmtHour(timeIndex)}
          aria-label={tSim('timelineScrubberLabel')}
          className="w-full h-2 bg-surface-elevated rounded-lg appearance-none cursor-pointer accent-energy-cyan
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        />

        {/* 24-Hour Markers */}
        <div className="flex items-center justify-between text-[10px] font-mono text-text-muted select-none">
          <span>00:00</span>
          <span>06:00</span>
          <span className="text-solar-amber font-medium">12:00</span>
          <span>18:00</span>
          <span>23:00</span>
        </div>
      </div>

      {/* Live Step Telemetry at hour t (if simulation complete) */}
      {hasResults && stepResult && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-border/40 text-xs font-mono">
          <div className="p-2 rounded-control bg-surface-elevated/70 border border-border/60">
            <span className="text-[10px] text-text-muted block font-sans">{tSim('stepSolar')}</span>
            <span className="font-semibold text-solar-amber">{fmtKw(stepResult.solarKw)}</span>
          </div>

          <div className="p-2 rounded-control bg-surface-elevated/70 border border-border/60">
            <span className="text-[10px] text-text-muted block font-sans">
              {tSim('stepDemand')}
            </span>
            <span className="font-semibold text-energy-cyan">{fmtKw(stepResult.demandKw)}</span>
          </div>

          <div className="p-2 rounded-control bg-surface-elevated/70 border border-border/60">
            <span className="text-[10px] text-text-muted block font-sans">
              {tSim('stepServed')}
            </span>
            <span className="font-semibold text-battery-green">{fmtKw(stepResult.servedKw)}</span>
          </div>

          <div className="p-2 rounded-control bg-surface-elevated/70 border border-border/60">
            <span className="text-[10px] text-text-muted block font-sans">
              {tSim('stepBatteryPower')}
            </span>
            <span
              className={cn(
                'font-semibold',
                stepResult.batteryKw >= 0 ? 'text-battery-green' : 'text-solar-amber'
              )}
            >
              {stepResult.batteryKw >= 0 ? '+' : ''}
              {fmtKw(stepResult.batteryKw)}
            </span>
          </div>

          <div className="p-2 rounded-control bg-surface-elevated/70 border border-border/60 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-text-muted block font-sans">
              {tSim('stepBatterySoc')}
            </span>
            <span className="font-semibold text-battery-green">{fmtPct(stepResult.socPct)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
