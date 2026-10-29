'use client';

import { useMemo } from 'react';
import { SECTOR_IDS, type SectorId } from '@mitsinjo/engine';
import { useTranslations } from '@/lib/i18n';
import { fmtKw } from '@/lib/format';
import type { SceneModel, StatusColor } from '../types';
import { feederTones } from '../utils/feeder-tone';

export interface FeederLabels {
  tones: Record<SectorId, StatusColor>;
  /** "Health: Closed (2.0 kW)" per sector (breaker state + served power). */
  titles: Record<SectorId, string>;
}

/** Display tone + translated breaker tooltip of every controller feeder (3D and 2D views). */
export function useFeederLabels(model: SceneModel): FeederLabels {
  const t = useTranslations('features.gridDiagram');
  const tSectors = useTranslations('sectors');
  return useMemo(() => {
    const titles = {} as Record<SectorId, string>;
    for (const id of SECTOR_IDS) {
      const state = model.controller.feeders[id].breaker;
      titles[id] = t(`breakerTooltip.${state}`, {
        sector: tSectors(id),
        kw: fmtKw(model.buildings[id].servedKw),
      });
    }
    return { tones: feederTones(model), titles };
  }, [model, t, tSectors]);
}
