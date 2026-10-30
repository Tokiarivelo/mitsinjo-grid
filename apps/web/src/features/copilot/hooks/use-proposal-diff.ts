import {
  DEFAULT_DROP_DURATION_H,
  DEFAULT_DROP_START_HOUR,
  getSolarDrop,
  resolveLifelineKw,
  type SectorId,
} from '@mitsinjo/engine';
import { useTranslations } from '@/lib/i18n';
import { useSimulationStore } from '@/stores';
import { fmtKw } from '@/lib/format';
import type { CopilotProposal, ProposalDiffItem } from '../types';

/**
 * Settings a proposal changes, each as "current → proposed", translated.
 * Current values are read from the simulation now, so snapshot the list before applying the change.
 */
export function useProposalDiff(proposal: CopilotProposal): ProposalDiffItem[] {
  const t = useTranslations('features.copilot');
  const tSectors = useTranslations('sectors');
  const tPriorities = useTranslations('priorities');
  const tStrategies = useTranslations('strategies');
  const tCommon = useTranslations('common');
  const input = useSimulationStore((s) => s.input);
  const activeStrategy = useSimulationStore((s) => s.activeStrategy);

  const patch = proposal.patch;
  const items: ProposalDiffItem[] = [];
  const pct = (v: number) => `${v}%`;

  if (proposal.strategy !== undefined) {
    items.push({
      label: t('diffDispatchPolicy'),
      current: tStrategies(activeStrategy),
      proposed: tStrategies(proposal.strategy),
    });
  }

  for (const [secId, prio] of Object.entries(patch?.priorities ?? {})) {
    if (!prio) continue;
    const currentPrio = input.sectors.find((s) => s.id === secId)?.priority;
    items.push({
      label: `${tSectors(secId as SectorId)} ${t('diffPriorityLabel')}`,
      current: currentPrio ? tPriorities(currentPrio) : t('unknownValue'),
      proposed: tPriorities(prio),
    });
  }

  for (const cap of patch?.sectorCaps ?? []) {
    const existing = input.sectorCaps?.find((c) => c.sector === cap.sector);
    items.push({
      label: `${tSectors(cap.sector)} ${t('diffCapLabel')}`,
      current: existing
        ? tCommon('capRange', {
            maxKw: existing.maxKw,
            from: existing.fromHour,
            to: existing.toHour,
          })
        : t('noCap'),
      proposed: tCommon('capRange', { maxKw: cap.maxKw, from: cap.fromHour, to: cap.toHour }),
    });
  }

  const drop = getSolarDrop(input);
  if (patch?.solarDropPct !== undefined) {
    items.push({
      label: t('diffSolarDrop'),
      current: pct(drop.pct),
      proposed: pct(patch.solarDropPct),
    });
  }
  if (patch?.dropStartHour !== undefined || patch?.dropDurationH !== undefined) {
    const window = (start: number, dur: number) =>
      t('dropWindowValue', { from: start, to: start + dur, hours: dur });
    items.push({
      label: t('diffDropWindow'),
      current: drop.pct > 0 ? window(drop.startHour, drop.durationH) : t('noValue'),
      proposed: window(
        patch?.dropStartHour ?? DEFAULT_DROP_START_HOUR,
        patch?.dropDurationH ?? DEFAULT_DROP_DURATION_H
      ),
    });
  }
  if (patch?.demandMultiplier !== undefined) {
    items.push({
      label: t('diffDemandMultiplier'),
      current: `${input.demandMultiplier}×`,
      proposed: `${patch.demandMultiplier}×`,
    });
  }
  if (patch?.batteryCapacityKwh !== undefined) {
    items.push({
      label: t('diffBatteryCapacity'),
      current: `${input.battery.capacityKwh} kWh`,
      proposed: `${patch.batteryCapacityKwh} kWh`,
    });
  }
  if (patch?.initialSocPct !== undefined) {
    items.push({
      label: t('diffInitialSoc'),
      current: pct(input.battery.initialSocPct),
      proposed: pct(patch.initialSocPct),
    });
  }
  if (patch?.minSocPct !== undefined) {
    items.push({
      label: t('diffMinSoc'),
      current: pct(input.battery.minSocPct),
      proposed: pct(patch.minSocPct),
    });
  }
  if (patch?.lifeline?.enabled !== undefined) {
    const on = input.strategyParams?.lifeline?.enabled !== false;
    items.push({
      label: t('diffLifelineStatus'),
      current: on ? tCommon('enabled') : tCommon('disabled'),
      proposed: patch.lifeline.enabled ? tCommon('enabled') : tCommon('disabled'),
    });
  }
  for (const [secId, kw] of Object.entries(patch?.lifeline?.kw ?? {})) {
    if (kw === undefined) continue;
    const sector = secId as SectorId;
    // Unset floors use the engine default, never 0.
    const currentKw = resolveLifelineKw(
      sector,
      input.sectors.find((s) => s.id === sector)?.lifelineKw
    );
    items.push({
      label: `${tSectors(sector)} ${t('diffLifelineFloor')}`,
      current: fmtKw(currentKw, 2),
      proposed: fmtKw(kw, 2),
    });
  }
  for (const [secId, mult] of Object.entries(patch?.sectorLoads ?? {})) {
    if (mult === undefined) continue;
    const sector = secId as SectorId;
    const current = input.sectors.find((s) => s.id === sector)?.loadMultiplier ?? 1;
    const fmtLoad = (v: number) => (v === 0 ? t('loadDisconnected') : `${v}×`);
    items.push({
      label: `${tSectors(sector)} ${t('diffSectorLoad')}`,
      current: fmtLoad(current),
      proposed: fmtLoad(mult),
    });
  }

  return items;
}
