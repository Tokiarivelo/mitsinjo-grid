'use client';

import { useId, useState } from 'react';
import { Bot, RotateCcw, SlidersHorizontal, Sparkles } from 'lucide-react';
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
}

const MODES: readonly {
  id: DispatchMode;
  icon: typeof SlidersHorizontal;
  labelKey: 'modeManual' | 'modeAssisted' | 'modeAutonomous';
  descKey: 'modeManualDesc' | 'modeAssistedDesc' | 'modeAutonomousDesc';
}[] = [
  {
    id: 'manual',
    icon: SlidersHorizontal,
    labelKey: 'modeManual',
    descKey: 'modeManualDesc',
  },
  {
    id: 'assisted',
    icon: Bot,
    labelKey: 'modeAssisted',
    descKey: 'modeAssistedDesc',
  },
  {
    id: 'autonomous',
    icon: Sparkles,
    labelKey: 'modeAutonomous',
    descKey: 'modeAutonomousDesc',
  },
];

export function DispatchModeToggle({
  variant = 'header',
  collapsed = false,
  className,
}: DispatchModeToggleProps) {
  const t = useTranslations('features.dispatch');
  const dispatchMode = useSimulationStore((s) => s.dispatchMode);
  const setDispatchMode = useSimulationStore((s) => s.setDispatchMode);
  const takeBackControl = useSimulationStore((s) => s.takeBackControl);
  const groupId = useId();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAutonomous = dispatchMode === 'autonomous';

  // 1. HEADER VARIANT
  if (variant === 'header') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {/* Permanent "IA AUX COMMANDES" badge + "Reprendre la main" button in autonomous mode */}
        {isAutonomous ? (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-ai-violet/15 text-ai-violet border border-ai-violet/40 shadow-xs"
              role="status"
              aria-live="polite"
            >
              <Sparkles
                className="h-3.5 w-3.5 motion-safe:animate-pulse text-ai-violet"
                aria-hidden="true"
              />
              <span>{t('aiInControl')}</span>
            </span>

            <Button
              variant="danger"
              size="sm"
              onClick={takeBackControl}
              aria-label={t('takeBackControl')}
              title={t('takeBackControlHint')}
              icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
              className="min-h-[44px] px-3 font-semibold text-xs shrink-0 cursor-pointer shadow-sm"
            >
              {t('takeBackControl')}
            </Button>
          </div>
        ) : (
          /* Segmented 3-tier selector for manual / assisted / autonomous */
          <div
            role="radiogroup"
            aria-label={t('modeLabel')}
            className="hidden md:inline-flex items-center p-0.5 rounded-control bg-surface border border-border"
          >
            {MODES.map((mode) => {
              const active = dispatchMode === mode.id;
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setDispatchMode(mode.id)}
                  title={t(mode.descKey)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-control-sm text-xs font-sans font-medium transition-colors cursor-pointer',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan',
                    active
                      ? mode.id === 'autonomous'
                        ? 'bg-ai-violet text-surface font-semibold shadow-xs'
                        : 'bg-surface-elevated text-text-primary font-semibold shadow-xs border border-border/80'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-hover/60'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-3 w-3',
                      active
                        ? mode.id === 'autonomous'
                          ? 'text-surface'
                          : 'text-energy-cyan'
                        : 'text-text-muted'
                    )}
                    aria-hidden="true"
                  />
                  <span>{t(mode.labelKey)}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Mobile dropdown trigger when not autonomous */}
        {!isAutonomous && (
          <div className="md:hidden relative">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={t('modeLabel')}
              aria-expanded={mobileMenuOpen}
              className="flex items-center gap-1.5 h-8 px-2 rounded-control text-xs font-sans font-medium bg-surface text-text-secondary border border-border hover:bg-surface-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-energy-cyan cursor-pointer"
            >
              <Bot className="h-3.5 w-3.5 text-energy-cyan" aria-hidden="true" />
              <span className="truncate max-w-[80px]">
                {t(`mode${dispatchMode.charAt(0).toUpperCase() + dispatchMode.slice(1)}` as never)}
              </span>
            </button>

            {mobileMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-50 w-44 rounded-card border border-border bg-surface-elevated shadow-lg p-1 flex flex-col gap-0.5"
                role="menu"
              >
                {MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setDispatchMode(mode.id);
                      setMobileMenuOpen(false);
                    }}
                    className={cn(
                      'flex items-center gap-2 w-full px-2.5 py-2 rounded-control-sm text-xs text-left cursor-pointer transition-colors',
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
        )}
      </div>
    );
  }

  // 2. SIDEBAR VARIANT
  if (variant === 'sidebar') {
    if (collapsed) {
      return (
        <div className={cn('flex flex-col items-center gap-1', className)}>
          <button
            type="button"
            onClick={() => {
              if (isAutonomous) takeBackControl();
              else {
                const nextMode =
                  dispatchMode === 'manual'
                    ? 'assisted'
                    : dispatchMode === 'assisted'
                      ? 'autonomous'
                      : 'manual';
                setDispatchMode(nextMode);
              }
            }}
            title={`${t('modeLabel')}: ${t(`mode${dispatchMode.charAt(0).toUpperCase() + dispatchMode.slice(1)}` as never)}`}
            aria-label={`${t('modeLabel')}: ${t(`mode${dispatchMode.charAt(0).toUpperCase() + dispatchMode.slice(1)}` as never)}`}
            className={cn(
              'h-11 w-11 flex items-center justify-center rounded-control transition-colors cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan',
              isAutonomous
                ? 'bg-ai-violet/20 text-ai-violet border border-ai-violet/50 animate-pulse'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            )}
          >
            {isAutonomous ? (
              <Sparkles className="h-4 w-4 text-ai-violet" aria-hidden="true" />
            ) : dispatchMode === 'assisted' ? (
              <Bot className="h-4 w-4 text-energy-cyan" aria-hidden="true" />
            ) : (
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            )}
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
          {isAutonomous && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold uppercase text-ai-violet"
              role="status"
            >
              <Sparkles className="h-2.5 w-2.5 motion-safe:animate-pulse" aria-hidden="true" />
              {t('aiInControl')}
            </span>
          )}
        </div>

        {isAutonomous && (
          <Button
            variant="danger"
            size="sm"
            onClick={takeBackControl}
            aria-label={t('takeBackControl')}
            title={t('takeBackControlHint')}
            icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
            className="min-h-[44px] w-full justify-center font-semibold text-xs cursor-pointer"
          >
            {t('takeBackControl')}
          </Button>
        )}

        <div
          role="radiogroup"
          aria-label={t('modeLabel')}
          className="grid grid-cols-3 p-1 rounded-control bg-canvas-sunken/80 border border-border gap-1"
        >
          {MODES.map((mode) => {
            const active = dispatchMode === mode.id;
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setDispatchMode(mode.id)}
                title={t(mode.descKey)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-control-sm text-[10px] font-sans transition-colors cursor-pointer min-h-[40px]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan',
                  active
                    ? mode.id === 'autonomous'
                      ? 'bg-ai-violet text-surface font-semibold shadow-xs'
                      : 'bg-surface-elevated text-text-primary font-semibold shadow-xs border border-border/80'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface/50'
                )}
              >
                <Icon
                  className={cn(
                    'h-3.5 w-3.5',
                    active
                      ? mode.id === 'autonomous'
                        ? 'text-surface'
                        : 'text-energy-cyan'
                      : 'text-text-muted'
                  )}
                  aria-hidden="true"
                />
                <span className="truncate max-w-full">{t(mode.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // 3. MOBILE DOCKED / OVERLAY VARIANT
  if (variant === 'mobile') {
    return (
      <div className={cn('w-full', className)}>
        {isAutonomous ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-2 p-2 rounded-card bg-surface-elevated/95 backdrop-blur-md border border-ai-violet/50 shadow-lg"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ai-violet/20 border border-ai-violet/40 shrink-0">
                <Sparkles
                  className="h-4 w-4 text-ai-violet motion-safe:animate-pulse"
                  aria-hidden="true"
                />
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-ai-violet tracking-tight truncate">
                  {t('aiInControl')}
                </span>
                <span className="text-[10px] text-text-secondary truncate">
                  {t('modeAutonomousDesc')}
                </span>
              </div>
            </div>

            <Button
              variant="danger"
              size="sm"
              onClick={takeBackControl}
              aria-label={t('takeBackControl')}
              title={t('takeBackControlHint')}
              icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
              className="min-h-[44px] px-3 font-semibold text-xs shrink-0 cursor-pointer shadow-sm"
            >
              {t('takeBackControl')}
            </Button>
          </div>
        ) : (
          <div
            role="radiogroup"
            aria-label={t('modeLabel')}
            className="grid grid-cols-3 p-1 rounded-control bg-surface-elevated border border-border gap-1"
          >
            {MODES.map((mode) => {
              const active = dispatchMode === mode.id;
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setDispatchMode(mode.id)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 py-2 px-2 rounded-control-sm text-xs font-sans font-medium transition-colors cursor-pointer min-h-[44px]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan',
                    active
                      ? mode.id === 'autonomous'
                        ? 'bg-ai-violet text-surface font-semibold shadow-xs'
                        : 'bg-surface text-energy-cyan font-semibold shadow-xs border border-border'
                      : 'text-text-muted hover:text-text-primary'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t(mode.labelKey)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // 4. CARD VARIANT (for embedding in deck cards)
  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-3 rounded-card border border-border/80 bg-surface/60',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <label
          id={`dispatch-label-${groupId}`}
          className="text-xs font-semibold text-text-primary flex items-center gap-1.5"
        >
          <Bot className="h-4 w-4 text-ai-violet" aria-hidden="true" />
          {t('modeLabel')}
        </label>
        {isAutonomous && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-ai-violet/15 text-ai-violet border border-ai-violet/30">
            <Sparkles className="h-2.5 w-2.5 motion-safe:animate-pulse" aria-hidden="true" />
            {t('aiInControl')}
          </span>
        )}
      </div>

      {isAutonomous && (
        <Button
          variant="danger"
          size="sm"
          onClick={takeBackControl}
          aria-label={t('takeBackControl')}
          title={t('takeBackControlHint')}
          icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
          className="min-h-[44px] w-full justify-center font-semibold text-sm cursor-pointer"
        >
          {t('takeBackControl')}
        </Button>
      )}

      <div
        role="radiogroup"
        aria-labelledby={`dispatch-label-${groupId}`}
        className="grid grid-cols-3 p-1 rounded-control bg-canvas-sunken/80 border border-border gap-1"
      >
        {MODES.map((mode) => {
          const active = dispatchMode === mode.id;
          const Icon = mode.icon;
          return (
            <button
              key={mode.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setDispatchMode(mode.id)}
              title={t(mode.descKey)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-control-sm text-xs font-sans transition-colors cursor-pointer min-h-[44px]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan',
                active
                  ? mode.id === 'autonomous'
                    ? 'bg-ai-violet text-surface font-semibold shadow-xs'
                    : 'bg-surface-elevated text-text-primary font-semibold shadow-xs border border-border/80'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface/50'
              )}
            >
              <Icon
                className={cn(
                  'h-3.5 w-3.5',
                  active
                    ? mode.id === 'autonomous'
                      ? 'text-surface'
                      : 'text-energy-cyan'
                    : 'text-text-muted'
                )}
                aria-hidden="true"
              />
              <span className="truncate max-w-full text-[11px]">{t(mode.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
