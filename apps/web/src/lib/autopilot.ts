import {
  simulate,
  type InputPatch,
  type SectorId,
  type SimulationInput,
  type StrategyId,
} from '@mitsinjo/engine';
import { checkConstitution, DEFAULT_CONSTITUTION, type ConstitutionRule } from './constitution';

/**
 * Rule-based autopilot (M10-T1): one protective suggestion per simulated hour, no LLM. The UI
 * offers it for one-tap accept/refuse; the engine numbers behind it come from real simulations.
 */

export type AutopilotRule = 'strategy' | 'lifeline';

export interface AutopilotSuggestion {
  hour: number;
  rule: AutopilotRule;
  patch?: InputPatch;
  strategy?: StrategyId;
  /** Short (kWh) that triggered the rule, for the UI text. */
  shortKwh: number;
}

/** Below this the short is noise — the autopilot stays quiet. */
const MIN_SHORT_KWH = 0.05;
const STRATEGY_ORDER: StrategyId[] = ['essential_first', 'balanced', 'proportional'];
const HEALTH: SectorId = 'health';

function healthShort(input: SimulationInput, strategy: StrategyId, hour: number): number {
  const step = simulate(input, strategy).steps[hour];
  const health = step?.sectors[HEALTH];
  return health ? Math.max(0, health.demandKw - health.servedKw) : 0;
}

/**
 * R1: the clinic loses power under the current strategy but another strategy serves it fully →
 * propose the switch. R2: no strategy serves it → propose a lifeline floor for the clinic
 * (capped at 2 kW; nothing when already covered). Otherwise null.
 *
 * Every candidate is verified against the village constitution first (M10-T2): a violating rule
 * is skipped, so the autopilot stays silent rather than propose a forbidden change. Human-driven
 * copilot proposals keep their double-confirmation override instead (M1-T2).
 */
export function autopilotProposal(
  input: SimulationInput,
  hour: number,
  strategy: StrategyId,
  rules: readonly ConstitutionRule[] = DEFAULT_CONSTITUTION
): AutopilotSuggestion | null {
  const h = Math.min(23, Math.max(0, Math.floor(hour)));
  const short = healthShort(input, strategy, h);
  if (short <= MIN_SHORT_KWH) return null;
  const current = input.sectors.find((s) => s.id === HEALTH)?.lifelineKw ?? 0;

  for (const candidate of STRATEGY_ORDER) {
    if (candidate === strategy) continue;
    if (healthShort(input, candidate, h) < MIN_SHORT_KWH) {
      const { violations } = checkConstitution(rules, { strategy: candidate });
      if (violations.length === 0) {
        return { hour: h, rule: 'strategy', strategy: candidate, shortKwh: short };
      }
    }
  }

  const step = simulate(input, strategy).steps[h];
  const need = step?.sectors[HEALTH]?.criticalDemandKw ?? 0;
  const floor = Math.min(2, Math.ceil(need * 10) / 10);
  if (floor > current) {
    const patch: InputPatch = { lifeline: { kw: { [HEALTH]: floor } } };
    const { violations } = checkConstitution(rules, {
      patch,
      floors: { [HEALTH]: floor },
    });
    if (violations.length === 0) {
      return { hour: h, rule: 'lifeline', patch, shortKwh: short };
    }
  }
  return null;
}
