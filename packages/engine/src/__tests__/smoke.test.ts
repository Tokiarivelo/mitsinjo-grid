import { describe, expect, it } from 'vitest';
import {
  ENGINE_VERSION,
  PrioritySchema,
  ScenarioIdSchema,
  SectorIdSchema,
  StrategyIdSchema,
} from '../index';

describe('Engine smoke test', () => {
  it('exports engine version', () => {
    expect(ENGINE_VERSION).toBe('0.3.0');
  });

  it('validates sector ids', () => {
    expect(SectorIdSchema.safeParse('health').success).toBe(true);
    expect(SectorIdSchema.safeParse('market').success).toBe(true);
    expect(SectorIdSchema.safeParse('unknown').success).toBe(false);
  });

  it('validates priority tiers', () => {
    expect(PrioritySchema.safeParse('critical').success).toBe(true);
    expect(PrioritySchema.safeParse('emergency').success).toBe(false);
  });

  it('validates strategies', () => {
    expect(StrategyIdSchema.safeParse('proportional').success).toBe(true);
    expect(StrategyIdSchema.safeParse('essential_first').success).toBe(true);
    expect(StrategyIdSchema.safeParse('balanced').success).toBe(true);
  });

  it('validates scenario presets', () => {
    expect(ScenarioIdSchema.safeParse('baseline').success).toBe(true);
    expect(ScenarioIdSchema.safeParse('cloudy_afternoon').success).toBe(true);
  });
});
