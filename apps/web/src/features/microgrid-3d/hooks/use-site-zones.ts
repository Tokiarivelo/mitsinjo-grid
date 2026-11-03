'use client';

import { useMemo } from 'react';
import { usePlacedModelsStore, useSimulationStore } from '@/stores';
import type { KeepOutZone } from '../utils/landscape';
import {
  applianceZoneItems,
  dynamicPlacedZones,
  siteZones,
  type ZoneSource,
} from '../utils/site-zones';

/** Current site zones (static + every placed line), read once: for commit-time callbacks (PI-T3). */
export function readSiteZones(): KeepOutZone[] {
  const appliances = useSimulationStore.getState().input.appliances;
  const models = usePlacedModelsStore.getState().models;
  return siteZones(applianceZoneItems(appliances, models));
}

/** Live site zones (static + placed lines) for the placement map (PI-T3). */
export function useSiteZones(): KeepOutZone[] {
  const appliances = useSimulationStore((s) => s.input.appliances);
  const models = usePlacedModelsStore((s) => s.models);
  return useMemo(() => siteZones(applianceZoneItems(appliances, models)), [appliances, models]);
}

/** Clearings of the placed lines only (no static zones): tree clearing and yards (PI-T4/T5). */
export function usePlacedClearings(appliances: readonly ZoneSource[] | undefined): KeepOutZone[] {
  const models = usePlacedModelsStore((s) => s.models);
  return useMemo(
    () => dynamicPlacedZones(applianceZoneItems(appliances, models)),
    [appliances, models]
  );
}
