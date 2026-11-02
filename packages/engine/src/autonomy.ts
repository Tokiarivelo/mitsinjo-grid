import { canonicalJson, fnv1a64 } from './hash';
import { SEVERITY_RANK, type DispatchLogEntry, type Incident } from './schemas';

/**
 * Audit hash of a log line (PA): FNV-1a 64 of its canonical JSON, `hash` field excluded.
 * Same line → same hash, whatever the key order.
 */
export function dispatchLogHash(entry: Omit<DispatchLogEntry, 'hash'> | DispatchLogEntry): string {
  const { hash: _ignored, ...rest } = entry as DispatchLogEntry;
  return fnv1a64(canonicalJson(rest));
}

/** Incidents most severe first, then earliest (day, hour); stable otherwise. Never mutates. */
export function sortIncidents(incidents: readonly Incident[]): Incident[] {
  return [...incidents].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.day - b.day || a.hour - b.hour
  );
}
