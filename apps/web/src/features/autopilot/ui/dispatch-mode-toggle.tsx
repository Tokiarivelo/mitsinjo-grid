'use client';

import { useId, useState } from 'react';
import { Bot, Play, RotateCcw, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { DispatchMode } from '@mitsinjo/engine';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useSimulationStore } from '@/stores';

export type DispatchModeToggleVariant = 'header' | 'sidebar' | 'mobile' | 'card';

export interface DispatchModeToggleProps {
  variant?: DispatchModeToggleVariant;
  collapsed?: boolean;
  className?: string;
  onOpenLog?: () => void;
}

const MODES = [
  { id: 'manual', icon: SlidersHorizontal, labelKey: 'modeManual', descKey: 'modeManualDesc' },
  { id: 'assisted', icon: Bot, labelKey: 'modeAssisted', descKey: 'modeAssistedDesc' },
  { id: 'autonomous', icon: Sparkles, labelKey: 'modeAutonomous', descKey: 'modeAutonomousDesc' },
] as const satisfies readonly {
  id: DispatchMode;
  icon: typeof SlidersHorizontal;
  labelKey: string;
  descKey: string;
}[];

type ModeDef = (typeof MODES)[number];

function modeDef(mode: DispatchMode): ModeDef {
  return MODES.find((m) => m.id === mode) ?? MODES[0];
}

/** Manual → assisted → autonomous → manual (folded sidebar rail). */
function nextMode(mode: DispatchMode): DispatchMode {
  const i = MODES.findIndex((m) => m.id === mode);
  return MODES[(i + 1) % MODES.length]!.id;
}

/** "Take back control": one tap back to manual, ≥ 44 px. */
function TakeBackButton({ className }: { className?: string }) {
  const t = useTranslations('features.dispatch');
  const takeBackControl = useSimulationStore((s) => s.takeBackControl);
  return (
    <Button
      variant="danger"
      size="sm"
      onClick={takeBackControl}
      title={t('takeBackControlHint')}
      icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
      className={cn('min-h-[44px] px-3 font-semibold text-xs shrink-0 cursor-pointer', className)}
    >
      {t('takeBackControl')}
    </Button>
  );
}

/** Permanent "AI IN CONTROL" pill (ai-violet). */
function AiInControlBadge({ className }: { className?: string }) {
  const t = useTranslations('features.dispatch');
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-ai-violet/15 text-ai-violet border border-ai-violet/40',
        className
      )}
    >
      <Sparkles className="h-3.5 w-3.5 motion-safe:animate-pulse" aria-hidden="true" />
      <span>{t('aiInControl')}</span>
    </span>
  );
}

/** The 3-mode radio group, shared by every variant. */
function ModeRadioGroup({
  layout,
  labelledBy,
  className,
}: {
  /** `inline`: one row of icon + label · `stacked`: 3 columns, icon over label. */
  layout: 'inline' | 'stacked';
  labelledBy?: string;
  className?: string;
}) {
  const t = useTranslations('features.dispatch');
  const dispatchMode = useSimulationStore((s) => s.dispatchMode);
  const setDispatchMode = useSimulationStore((s) => s.setDispatchMode);
  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : t('modeLabel')}
      aria-labelledby={labelledBy}
      className={cn(
        'p-1 gap-1 rounded-control border border-border',
        layout === 'inline'
          ? 'inline-flex items-center bg-surface'
          : 'grid grid-cols-3 bg-canvas-sunken/80',
        className
      )}
    >
      {MODES.map((mode) => {
        const active = dispatchMode === mode.id;
        const Icon = mode.icon;
        const violet = active && mode.id === 'autonomous';
        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setDispatchMode(mode.id)}
            title={t(mode.descKey)}
            className={cn(
              'flex items-center justify-center gap-1 rounded-control-sm text-xs font-sans transition-colors cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan',
              layout === 'inline' ? 'px-2.5 py-1' : 'flex-col px-1 py-1.5 min-h-[44px]',
              violet
                ? 'bg-ai-violet text-surface font-semibold shadow-xs'
                : active
                  ? 'bg-surface-elevated text-text-primary font-semibold shadow-xs border border-border/80'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-hover/60'
            )}
          >
            <Icon
              className={cn(
                'h-3.5 w-3.5',
                violet ? 'text-surface' : active ? 'text-energy-cyan' : 'text-text-muted'
              )}
              aria-hidden="true"
            />
            <span className="truncate max-w-full">{t(mode.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Compact header menu (below 2xl, where the full radio group would crowd the header). */
function ModeMenu({ className }: { className?: string }) {
  const t = useTranslations('features.dispatch');
  const dispatchMode = useSimulationStore((s) => s.dispatchMode);
  const setDispatchMode = useSimulationStore((s) => s.setDispatchMode);
  const [open, setOpen] = useState(false);
  const current = modeDef(dispatchMode);
  return (
    <div
      className={cn('relative', className)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`${t('modeLabel')}: ${t(current.labelKey)}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 h-8 px-2 rounded-control text-xs font-sans font-medium bg-surface text-text-secondary border border-border hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan cursor-pointer"
      >
        <current.icon className="h-3.5 w-3.5 text-energy-cyan" aria-hidden="true" />
        <span className="hidden sm:inline truncate max-w-[96px]">{t(current.labelKey)}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('modeLabel')}
          className="absolute right-0 top-full mt-1 z-50 w-48 rounded-card border border-border bg-surface-elevated shadow-lg p-1 flex flex-col gap-0.5"
        >
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              role="menuitemradio"
              aria-checked={dispatchMode === mode.id}
              onClick={() => {
                setDispatchMode(mode.id);
                setOpen(false);
              }}
              className={cn(
                'flex items-center gap-2 w-full px-2.5 min-h-[44px] rounded-control-sm text-xs text-left cursor-pointer transition-colors',
                dispatchMode === mode.id
                  ? 'bg-surface-hover text-text-primary font-semibold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface'
              )}
            >
              <mode.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{t(mode.labelKey)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DispatchModeToggle({
  variant = 'header',
  collapsed = false,
  className,
  onOpenLog,
}: DispatchModeToggleProps) {
  const t = useTranslations('features.dispatch');
  const dispatchMode = useSimulationStore((s) => s.dispatchMode);
  const setDispatchMode = useSimulationStore((s) => s.setDispatchMode);
  const takeBackControl = useSimulationStore((s) => s.takeBackControl);
  const isPlaying = useSimulationStore((s) => s.isPlaying);
  const dispatchLog = useSimulationStore((s) => s.dispatchLog);
  const groupId = useId();
  const isAutonomous = dispatchMode === 'autonomous';

  // 1. HEADER: below md the docked MobileNav bar carries the autonomous controls.
  if (variant === 'header') {
    if (isAutonomous) {
      return (
        <div className={cn('hidden md:flex items-center gap-2', className)}>
          <AiInControlBadge className="hidden xl:inline-flex" />
          <TakeBackButton />
        </div>
      );
    }
    return (
      <div className={cn('flex items-center', className)}>
        <ModeRadioGroup layout="inline" className="hidden 2xl:inline-flex p-0.5" />
        <ModeMenu className="2xl:hidden" />
      </div>
    );
  }

  // 2. SIDEBAR
  if (variant === 'sidebar') {
    if (collapsed) {
      const current = modeDef(dispatchMode);
      const label = `${t('modeLabel')}: ${t(current.labelKey)}`;
      return (
        <div className={cn('flex flex-col items-center gap-1', className)}>
          <button
            type="button"
            onClick={() =>
              isAutonomous ? takeBackControl() : setDispatchMode(nextMode(dispatchMode))
            }
            title={label}
            aria-label={label}
            className={cn(
              'h-11 w-11 flex items-center justify-center rounded-control transition-colors cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan',
              isAutonomous
                ? 'bg-ai-violet/20 text-ai-violet border border-ai-violet/50 motion-safe:animate-pulse'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            )}
          >
            <current.icon
              className={cn(
                'h-4 w-4',
                isAutonomous && 'text-ai-violet',
                dispatchMode === 'assisted' && 'text-energy-cyan'
              )}
              aria-hidden="true"
            />
          </button>
        </div>
      );
    }

    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
            {t('modeLabel')}
          </span>
          {isAutonomous && <AiInControlBadge className="inline-flex px-1.5 py-0.5 text-[10px]" />}
        </div>
        {isAutonomous && <TakeBackButton className="w-full justify-center" />}
        <ModeRadioGroup layout="stacked" className="text-[10px]" />
      </div>
    );
  }

  // 3. MOBILE (docked above MobileNav)
  if (variant === 'mobile') {
    return (
      <div className={cn('w-full', className)}>
        {isAutonomous ? (
          <div className="flex items-center justify-between gap-2 p-2 rounded-card bg-surface-elevated/95 backdrop-blur-md border border-ai-violet/50 shadow-lg">
            <div className="flex flex-col min-w-0">
              <AiInControlBadge className="inline-flex self-start" />
              <span className="mt-0.5 text-[10px] text-text-secondary truncate">
                {t('modeAutonomousDesc')}
              </span>
            </div>
            <TakeBackButton />
          </div>
        ) : (
          <ModeRadioGroup layout="stacked" className="bg-surface-elevated" />
        )}
      </div>
    );
  }

  // 4. CARD (deck)
  const aiActionsCount = dispatchLog.filter(
    (e) => e.mode === 'autonomous' && Boolean(e.action)
  ).length;

  // play() runs the engine first when the result is stale, then starts the hour ticker.
  const handleResumePlayback = () => useSimulationStore.getState().play();
  const handleLaunchAi = () => {
    setDispatchMode('autonomous');
    handleResumePlayback();
  };

  const labelId = `dispatch-label-${groupId}`;
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 p-3 rounded-card border border-border/80 bg-surface/60',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span
          id={labelId}
          className="text-xs font-semibold text-text-primary flex items-center gap-1.5"
        >
          <Bot className="h-4 w-4 text-ai-violet" aria-hidden="true" />
          {t('modeLabel')}
        </span>
        {isAutonomous && <AiInControlBadge className="inline-flex px-2 py-0.5 text-[10px]" />}
      </div>

      <ModeRadioGroup layout="stacked" labelledBy={labelId} />

      {/* Autonomous Active Card or 1-Click Launch Button */}
      {isAutonomous ? (
        <div className="flex flex-col gap-2 pt-0.5">
          <div className="flex flex-col gap-1.5 p-2.5 rounded-control bg-ai-violet/10 border border-ai-violet/30 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-semibold text-ai-violet text-[11px]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ai-violet opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-ai-violet" />
                </span>
                {t('modeAutonomous')}
              </span>
              {aiActionsCount > 0 && (
                <span className="text-[10px] font-mono text-text-secondary">
                  {t('decisionsCount', { count: aiActionsCount })}
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              {t('activeAutonomousHint')}
            </p>
            {onOpenLog && (
              <button
                type="button"
                onClick={onOpenLog}
                className="text-left text-[11px] font-medium text-energy-cyan hover:underline cursor-pointer pt-0.5"
              >
                {t('viewLogDecisions')}
              </button>
            )}
          </div>

          {!isPlaying && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleResumePlayback}
              icon={<Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />}
              className="w-full min-h-[44px] bg-ai-violet text-surface hover:bg-ai-violet/90 font-semibold text-xs cursor-pointer shadow-xs"
            >
              {t('resumeAutonomous')}
            </Button>
          )}

          <TakeBackButton className="w-full justify-center text-sm" />
        </div>
      ) : (
        <div className="pt-0.5">
          <Button
            variant="primary"
            size="sm"
            onClick={handleLaunchAi}
            icon={
              <Sparkles
                className="h-4 w-4 text-ai-violet motion-safe:animate-pulse"
                aria-hidden="true"
              />
            }
            className="w-full min-h-[44px] bg-ai-violet/15 hover:bg-ai-violet/25 text-ai-violet border border-ai-violet/40 font-semibold text-xs cursor-pointer transition-colors shadow-xs"
          >
            {t('launchAutonomous')}
          </Button>
        </div>
      )}
    </div>
  );
}
