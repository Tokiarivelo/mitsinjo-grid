'use client';

import { MAX_APPLIANCES } from '@mitsinjo/engine';
import { isAppliance, type ApplianceDetection } from '@/lib/vision';
import type { ObjectRecipe } from '@/lib/object-shape';
import { defaultArchetype } from '@/lib/object-kit';
import { sceneScale, usePlacedModelsStore } from '@/stores';
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
  /** Optional ready 3D recipe (PI-T1): stored in placed models on insert. */
  recipe?: ObjectRecipe | null;
}

/** Selected object → its load line in the store (PV-T12, PI-T1): insert, update or remove (immediate re-run). */
export function ApplianceInsert({ detection, name, photo, recipe }: ApplianceInsertProps) {
  const { list, upsert, remove } = useSimulationAppliances();
  const id = applianceIdFor(photo, detection.id);
  const existing = list.find((a) => a.id === id);
  const draft = useApplianceDraft(id, detection, name, existing);

  // A placed model needs a 3D recipe: the new one, or the one already stored for this object.
  const storedModel = usePlacedModelsStore((s) => s.models[id]);
  const modelRecipe = recipe ?? storedModel?.recipe;

  const handleInsert = () => {
    if (!draft.appliance) return;
    const ok = upsert(draft.appliance);
    if (!ok || !modelRecipe) return;
    const fresh = defaultArchetype(detection.category, detection.scenery, detection.label);
    const archetype = recipe ? fresh : (storedModel?.archetype ?? fresh);
    usePlacedModelsStore.getState().upsert({
      applianceId: id,
      recipe: modelRecipe,
      yaw: recipe ? recipe.yaw : storedModel?.yaw,
      scale: recipe ? sceneScale(archetype, recipe.proportions) : storedModel?.scale,
      archetype,
      connectionMode: draft.draft.connectionMode ?? 'branch',
    });
  };

  return (
    <ApplianceInsertPanel
      draft={draft}
      scenery={!isAppliance(detection)}
      inSimulation={Boolean(existing)}
      full={!existing && list.length >= MAX_APPLIANCES}
      canConnect={Boolean(modelRecipe)}
      onInsert={handleInsert}
      onRemove={() => remove(id)}
    />
  );
}
