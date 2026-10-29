import type { StrategyId } from '@mitsinjo/engine';

/** One theme-token color per strategy, shared by every strategy chart so series match. */
export const STRATEGY_COLORS: Record<StrategyId, string> = {
  proportional: 'var(--color-energy-cyan)',
  essential_first: 'var(--color-solar-amber)',
  balanced: 'var(--color-battery-green)',
};
