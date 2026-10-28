import type { StatusBadgeVariant } from '@/components/ui/status-badge';
import type { SimStatus } from '@/stores/simulation.store';

/** What the primary transport button does (and says) right now. */
export type PrimaryPlaybackAction = 'loading' | 'pause' | 'run' | 'play';

export function primaryPlaybackAction(
  status: SimStatus,
  isPlaying: boolean,
  hasResults: boolean
): PrimaryPlaybackAction {
  if (status === 'running') return 'loading';
  if (isPlaying) return 'pause';
  return status === 'modified' || !hasResults ? 'run' : 'play';
}

/** Simulation status badge: playback shows as running; a changed input wins over everything. */
export function simStatusBadgeVariant(status: SimStatus, isPlaying: boolean): StatusBadgeVariant {
  if (status === 'modified') return 'warning';
  if (status === 'error') return 'error';
  if (isPlaying || status === 'running') return 'running';
  return status === 'complete' ? 'complete' : 'ready';
}
