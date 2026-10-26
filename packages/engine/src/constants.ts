import type { StrategyId } from './schemas';

export const ENGINE_VERSION = '0.1.0';

export const EPS = 1e-9;

export const HORIZON_H = 24 as const;
export const STEP_H = 1 as const;

export const STRATEGIES: Record<StrategyId, { label: string; rule: string }> = {
  proportional: {
    label: 'Proportional',
    rule: 'Share available energy proportionally to demand across all sectors',
  },
  essential_first: {
    label: 'Essential First',
    rule: 'Strict priority waterfall: critical > high > medium > low',
  },
  balanced: {
    label: 'Balanced',
    rule: 'Serve critical shares for all first, then water-fill remaining demand by priority weights',
  },
};
