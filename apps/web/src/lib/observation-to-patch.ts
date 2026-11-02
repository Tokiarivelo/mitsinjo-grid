import type { InputPatch, SectorId } from '@mitsinjo/engine';
// Type-only, from schemas directly: this module also runs in client components (M4-T4),
// so it must not pull the server-only perception barrel.
import type { Observation } from '@/server/perception/schemas';

export interface UnmappedObservation {
  label: string;
  reason: string;
}

export interface ObservationToPatchOptions {
  /** Sector a meter reading belongs to (asked from the context, never guessed). */
  sector?: SectorId;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Vision observations → engine patch, pure code, no LLM (M4-T3). Cloud cover becomes a solar
 * drop proposal; panel shade/dust (M8-T2) becomes an all-day solar loss; a meter power reading
 * (kW, sector given) becomes 24 hourly readings. Anything else comes back in `unmapped` with a
 * reason — the caller proposes the patch via `propose_change`.
 *
 * One patch holds one drop: cloud (transient, engine default window) and panel loss (all day)
 * compete, max wins, ties go all-day. An approximation — shade under a passing cloud is neither
 * — but every figure stays an observed one.
 */
export function observationToPatch(
  observations: readonly Observation[],
  opts: ObservationToPatchOptions = {}
): { patch: InputPatch; unmapped: UnmappedObservation[] } {
  const patch: InputPatch = {};
  const unmapped: UnmappedObservation[] = [];
  let cloudPct = -1;
  let panelPct = -1;
  const noteDrop = (kind: 'cloud' | 'panel', value: number) => {
    const drop = clamp(Math.round(value), 0, 90);
    if (kind === 'cloud') cloudPct = Math.max(cloudPct, drop);
    else panelPct = Math.max(panelPct, drop);
  };
  for (const obs of observations) {
    if (obs.label === 'cloud_cover') {
      if (typeof obs.value !== 'number' || Number.isNaN(obs.value)) {
        unmapped.push({ label: obs.label, reason: 'cloud cover is not a number' });
        continue;
      }
      noteDrop('cloud', obs.value);
      continue;
    }
    if (obs.label === 'shaded_panel' || obs.label === 'dusty_panel') {
      if (typeof obs.value !== 'number' || Number.isNaN(obs.value)) {
        unmapped.push({ label: obs.label, reason: 'panel loss is not a number' });
        continue;
      }
      noteDrop('panel', obs.value);
      continue;
    }
    if (obs.label === 'meter_reading') {
      if (typeof obs.value !== 'number' || Number.isNaN(obs.value)) {
        unmapped.push({ label: obs.label, reason: 'meter reading is not a number' });
        continue;
      }
      if (!opts.sector) {
        unmapped.push({ label: obs.label, reason: 'meter reading needs a sector' });
        continue;
      }
      if (obs.unit !== undefined && obs.unit !== 'kW') {
        unmapped.push({
          label: obs.label,
          reason: `unit ${obs.unit} is not power: need kW, not cumulative energy`,
        });
        continue;
      }
      patch.meterReadings = {
        ...patch.meterReadings,
        [opts.sector]: new Array(24).fill(Math.max(0, obs.value)),
      };
      continue;
    }
    unmapped.push({ label: obs.label, reason: 'no conversion rule to an engine patch' });
  }
  if (panelPct >= 0 && panelPct >= cloudPct) {
    patch.solarDropPct = panelPct;
    patch.dropStartHour = 0;
    patch.dropDurationH = 24;
  } else if (cloudPct >= 0) {
    patch.solarDropPct = cloudPct;
  }
  return { patch, unmapped };
}
