'use client';

import { CloudOff, CloudSun, Cpu, Link2, Lock, Unlink } from 'lucide-react';
import { TIME_SCALE_PRESETS, type BridgeState } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { fmtHour } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { StatusBadge, type StatusBadgeVariant } from '@/components/ui/status-badge';
import type { LinkStatus } from '../hooks/use-hardware-link';

export interface HardwareLinkPanelProps {
  status: LinkStatus;
  bridge: BridgeState | null;
  /** False = read-only: the bridge refuses our commands (token missing or wrong). */
  control?: boolean;
  following: boolean;
  onToggleFollow: () => void;
  cloud: boolean;
  onToggleCloud: () => void;
  onSpeedChange: (timeScale: number) => void;
  className?: string;
}

const STATUS_VARIANT: Record<LinkStatus, StatusBadgeVariant> = {
  connected: 'complete',
  connecting: 'running',
  disconnected: 'warning',
};

/** Link to the physical scale model through the local bridge: status, scale, follow and cloud. */
export function HardwareLinkPanel({
  status,
  bridge,
  control = true,
  following,
  onToggleFollow,
  cloud,
  onToggleCloud,
  onSpeedChange,
  className,
}: HardwareLinkPanelProps) {
  const t = useTranslations('features.hardwareLink');
  const connected = status === 'connected';
  const canCommand = connected && control;

  return (
    <section
      aria-labelledby="hardware-link-title"
      className={cn(
        'flex flex-col gap-4 p-5 rounded-card bg-surface border border-border shadow-sm',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <Cpu className="h-4 w-4 shrink-0 text-energy-cyan" aria-hidden="true" />
          <h3
            id="hardware-link-title"
            className="font-display text-sm font-semibold text-text-primary tracking-tight"
          >
            {t('title')}
          </h3>
        </div>
        <StatusBadge variant={STATUS_VARIANT[status]} size="sm" label={t(`status.${status}`)} />
      </div>

      {bridge ? (
        <dl className="flex flex-col gap-2 text-xs">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <dt className="text-text-muted">{t('device')}</dt>
            <dd
              className={cn(
                'font-medium text-right',
                bridge.deviceOnline ? 'text-battery-green' : 'text-warning-amber'
              )}
            >
              {bridge.deviceOnline ? t('deviceOnline') : t('deviceOffline')}
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <dt className="text-text-muted">{t('mode')}</dt>
            <dd className="font-medium text-text-primary text-right">
              {t(`modes.${bridge.mode}`)}
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <dt className="text-text-muted">{t('scale')}</dt>
            <dd className="font-mono text-text-primary text-right">
              {t('scaleValue', {
                kw: bridge.scale.powerScale / 1000,
                seconds: bridge.scale.timeScale,
              })}
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <dt className="text-text-muted">{t('clock')}</dt>
            <dd className="font-mono text-text-primary text-right">
              {t('clockValue', { day: bridge.day + 1, hour: fmtHour(bridge.simHour) })}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-xs text-text-muted">{t('hint')}</p>
      )}

      {bridge && (
        <div className="flex flex-col gap-2">
          <span id="hardware-link-speed" className="text-xs text-text-muted">
            {t('speed')}
          </span>
          <div
            role="group"
            aria-labelledby="hardware-link-speed"
            className="grid grid-cols-4 gap-1.5"
          >
            {TIME_SCALE_PRESETS.map((seconds) => {
              const active = bridge.scale.timeScale === seconds;
              return (
                <Button
                  key={seconds}
                  variant={active ? 'primary' : 'secondary'}
                  size="sm"
                  className="min-h-11 px-0 font-mono"
                  aria-pressed={active}
                  aria-label={t('speedOptionLabel', { seconds })}
                  disabled={!canCommand}
                  onClick={() => onSpeedChange(seconds)}
                >
                  {t('speedOption', { seconds })}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {connected && !control && (
        <p className="flex items-start gap-2 text-xs text-warning-amber">
          <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{t('readOnly')}</span>
        </p>
      )}

      {following && (
        <StatusBadge variant="simulated" size="sm" label={t('deviceData')} className="self-start" />
      )}

      <div className="flex flex-col min-[400px]:flex-row gap-2">
        <Button
          variant={following ? 'secondary' : 'primary'}
          size="sm"
          className="min-h-11 min-[400px]:flex-1"
          aria-pressed={following}
          disabled={!following && !bridge}
          icon={
            following ? (
              <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            )
          }
          onClick={onToggleFollow}
        >
          {following ? t('stopFollowing') : t('follow')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="min-h-11 min-[400px]:flex-1"
          aria-pressed={cloud}
          disabled={!canCommand}
          icon={
            cloud ? (
              <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <CloudSun className="h-3.5 w-3.5" aria-hidden="true" />
            )
          }
          onClick={onToggleCloud}
        >
          {cloud ? t('cloudOff') : t('cloudOn')}
        </Button>
      </div>
    </section>
  );
}
