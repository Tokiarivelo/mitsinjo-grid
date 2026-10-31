'use client';

import { MAX_APPLIANCES } from '@mitsinjo/engine';
import { isAppliance, type ApplianceDetection } from '@/lib/vision';
import { useApplianceDraft } from '../hooks/use-appliance-draft';
import { useSimulationAppliances } from '../hooks/use-simulation-appliances';
import { applianceIdFor } from '../utils/appliance-draft';
import { ApplianceInsertPanel } from './appliance-insert-panel';

export interface ApplianceInsertProps {
  detection: ApplianceDetection;
  /** Object name in the page language (default line name). */
  name: string;
  /** `photoKey` of the current photo. */
  photo: string;
}

/** Selected object → its load line in the store (PV-T12): insert, update or remove (immediate re-run). */
export function ApplianceInsert({ detection, name, photo }: ApplianceInsertProps) {
  const { list, upsert, remove } = useSimulationAppliances();
  const id = applianceIdFor(photo, detection.id);
  const existing = list.find((a) => a.id === id);
  const draft = useApplianceDraft(id, detection, name, existing);

  return (
    <ApplianceInsertPanel
      draft={draft}
      scenery={!isAppliance(detection)}
      inSimulation={Boolean(existing)}
      full={!existing && list.length >= MAX_APPLIANCES}
      onInsert={() => draft.appliance && upsert(draft.appliance)}
      onRemove={() => remove(id)}
    />
  );
}
