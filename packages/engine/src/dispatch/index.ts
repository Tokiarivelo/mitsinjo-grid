import { isSectorConnected } from '../model';
import { SECTOR_IDS } from '../schemas';
import type {
  BreakerState,
  ControllerMode,
  FeederTone,
  SectorId,
  SectorMode,
  SimulationInput,
  SimulationResult,
} from '../schemas';

/** Served kW above which a feeder counts as carrying load (display threshold). */
export const ACTIVE_FEEDER_KW = 0.05;

/** Line flow (kW) at which the flow animation saturates. */
export const FLOW_SATURATION_KW = 3;

/** Feeder breaker for a sector mode: lifeline → limited, full/limited → closed, off → open. */
export function breakerFromMode(mode: SectorMode): BreakerState {
  if (mode === 'lifeline') return 'limited';
  return mode === 'full' || mode === 'limited' ? 'closed' : 'open';
}

/** Line flow kW → 0..1 level for electrons, wire strokes and LED animation. */
export function flowLevel(flowKw: number): number {
  if (!Number.isFinite(flowKw)) return 0;
  return Math.min(1, Math.max(0, flowKw / FLOW_SATURATION_KW));
}

function connected(input: SimulationInput, id: SectorId): boolean {
  const sector = input.sectors.find((s) => s.id === id);
  return sector ? isSectorConnected(sector) : false;
}

export interface FeederToneArgs {
  connected: boolean;
  demandKw: number;
  servedKw: number;
  breaker: BreakerState;
}

/**
 * Display tone of one feeder: limiter → warning, open on a sector left without power → critical,
 * open with nothing to serve (or disconnected) → idle, closed with no demand → idle,
 * closed → ok when fully served, warning when partly, critical when not served.
 */
export function feederTone({ connected, demandKw, servedKw, breaker }: FeederToneArgs): FeederTone {
  if (!connected) return 'idle';
  if (breaker === 'closed' && demandKw <= ACTIVE_FEEDER_KW) return 'idle';
  if (breaker === 'limited') return 'warning';
  const short = demandKw > 0 && servedKw < demandKw - ACTIVE_FEEDER_KW;
  const powered = servedKw > ACTIVE_FEEDER_KW;
  if (breaker === 'open') return short && !powered ? 'critical' : 'idle';
  if (!short) return 'ok';
  return powered ? 'warning' : 'critical';
}

/** Sector mode as dispatched: a disconnected sector is always `off`. */
export function feederModeAt(
  input: SimulationInput,
  result: SimulationResult,
  hour: number,
  id: SectorId
): SectorMode {
  if (!connected(input, id)) return 'off';
  return result.steps[hour]?.sectors[id]?.mode ?? 'off';
}

/**
 * Controller state at one hour: `normal` when every loaded feeder is full, `lifeline_only` on a
 * lifeline shortfall or when every loaded feeder is at lifeline/off, otherwise `rationing`.
 */
export function controllerModeAt(
  input: SimulationInput,
  result: SimulationResult,
  hour: number
): ControllerMode {
  const step = result.steps[hour];
  if (!step) return 'normal';
  const loaded = SECTOR_IDS.filter(
    (id) => connected(input, id) && (step.sectors[id]?.demandKw ?? 0) > ACTIVE_FEEDER_KW
  ).map((id) => feederModeAt(input, result, hour, id));

  if (loaded.every((m) => m === 'full')) return 'normal';
  const shortfall = result.warnings.some(
    (w) => w.code === 'LIFELINE_SHORTFALL' && hour >= w.fromHour && hour <= w.toHour
  );
  if (shortfall || loaded.every((m) => m === 'lifeline' || m === 'off')) return 'lifeline_only';
  return 'rationing';
}
