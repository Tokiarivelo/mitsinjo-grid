import { describe, expect, it } from 'vitest';
import { ENVELOPE_OFF, withinEnvelope } from '../envelope';
import type { AutopilotSuggestion } from '../autopilot';

const R1: AutopilotSuggestion = {
  hour: 18,
  rule: 'strategy',
  strategy: 'essential_first',
  shortKwh: 0.2,
};
const R2: AutopilotSuggestion = {
  hour: 20,
  rule: 'lifeline',
  patch: { lifeline: { kw: { health: 0.5 } } },
  shortKwh: 0.2,
};

describe('withinEnvelope (M10-T3)', () => {
  it('off by default: nothing applies alone', () => {
    expect(ENVELOPE_OFF).toEqual({ strategyChange: false, clinicFloor: false });
    expect(withinEnvelope(ENVELOPE_OFF, R1)).toBe(false);
    expect(withinEnvelope(ENVELOPE_OFF, R2)).toBe(false);
  });

  it('granular permissions: strategy yes, clinic floor never', () => {
    const envelope = { strategyChange: true, clinicFloor: false };
    expect(withinEnvelope(envelope, R1)).toBe(true);
    expect(withinEnvelope(envelope, R2)).toBe(false);
  });

  it('fully open envelope auto-applies both rules', () => {
    const envelope = { strategyChange: true, clinicFloor: true };
    expect(withinEnvelope(envelope, R1)).toBe(true);
    expect(withinEnvelope(envelope, R2)).toBe(true);
  });
});
