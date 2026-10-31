'use client';

import { MAX_APPLIANCES } from '@mitsinjo/engine';
import { selectInput, useSimulationStore } from '@/stores';
import { isAppliance, type ApplianceDetection } from '@/lib/vision';
import { useApplianceDraft } from '../hooks/use-appliance-draft';
import { applianceIdFor, upsertAppliance } from '../utils/appliance-draft';
import { ApplianceInsertPanel } from './appliance-insert-panel';

export interface ApplianceInsertProps {
  detection: ApplianceDetection;
  /** Object name in the page language (default line name). */
  name: string;
  /** `photoKey` of the current photo. */
  photo: string;
}

/**
 * Selected object → its load line in the store (PV-T12). Insert / update = `applyProposal({ appliances })`
 * (whole list replaced, immediate re-run of every strategy); remove = the list without it.
 */
export function ApplianceInsert({ detection, name, photo }: ApplianceInsertProps) {
  const input = useSimulationStore(selectInput);
  const applyProposal = useSimulationStore((s) => s.applyProposal);
  const id = applianceIdFor(photo, detection.id);
  const list = input.appliances ?? [];
  const existing = list.find((a) => a.id === id);
  const draft = useApplianceDraft(id, detection, name, existing);

  const insert = () => {
    if (!draft.appliance) return;
    const next = upsertAppliance(list, draft.appliance);
    if (next) applyProposal({ appliances: next });
  };
  const remove = () => applyProposal({ appliances: list.filter((a) => a.id !== id) });

  return (
    <ApplianceInsertPanel
      draft={draft}
      scenery={!isAppliance(detection)}
      inSimulation={Boolean(existing)}
      full={!existing && list.length >= MAX_APPLIANCES}
      onInsert={insert}
      onRemove={remove}
    />
  );
}
