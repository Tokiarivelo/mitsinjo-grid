import { describe, expect, it } from 'vitest';
import {
  AutoActionSchema,
  DispatchLogEntrySchema,
  DispatchModeSchema,
  IncidentSchema,
  dispatchLogHash,
  sortIncidents,
  type DispatchLogEntry,
  type Incident,
} from '../index';

const fire: Incident = {
  kind: 'fire',
  severity: 'critical',
  day: 0,
  hour: 14,
  sector: 'market',
  evidence: { servedKw: 0 },
};
const surplus: Incident = {
  kind: 'solar_surplus',
  severity: 'info',
  day: 0,
  hour: 12,
  evidence: { curtailedKw: 3.2 },
};
const snapshot = { resultId: 'r1', unservedKwh: 2, criticalUnservedKwh: 0, socEndPct: 41 };

function entry(over: Partial<DispatchLogEntry> = {}): Omit<DispatchLogEntry, 'hash'> {
  return {
    id: 'ai-d0-h14-1',
    day: 0,
    hour: 14,
    mode: 'autonomous',
    origin: 'ai',
    incident: fire,
    action: {
      kind: 'isolate_sector',
      sector: 'market',
      patch: { sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 14, toHour: 24 }] },
      answers: 'fire',
    },
    before: snapshot,
    after: { ...snapshot, resultId: 'r2' },
    ...over,
  };
}

describe('autonomy schemas (PA-T0b)', () => {
  it('dispatch modes: manual, assisted, autonomous only', () => {
    expect(DispatchModeSchema.options).toEqual(['manual', 'assisted', 'autonomous']);
    expect(DispatchModeSchema.safeParse('auto').success).toBe(false);
  });

  it('incident: hour 0–23, day within the 7-day workflow, numeric evidence only', () => {
    expect(IncidentSchema.safeParse(fire).success).toBe(true);
    expect(IncidentSchema.safeParse({ ...fire, hour: 24 }).success).toBe(false);
    expect(IncidentSchema.safeParse({ ...fire, day: 7 }).success).toBe(false);
    expect(IncidentSchema.safeParse({ ...fire, evidence: { servedKw: 'zero' } }).success).toBe(
      false
    );
  });

  it('action: strategy switch needs a strategy, sector actions need sector + patch, alerts change nothing', () => {
    expect(AutoActionSchema.safeParse({ kind: 'switch_strategy' }).success).toBe(false);
    expect(
      AutoActionSchema.safeParse({ kind: 'switch_strategy', strategy: 'essential_first' }).success
    ).toBe(true);
    expect(AutoActionSchema.safeParse({ kind: 'isolate_sector', sector: 'market' }).success).toBe(
      false
    );
    expect(AutoActionSchema.safeParse({ ...entry().action, sector: undefined }).success).toBe(
      false
    );
    expect(AutoActionSchema.safeParse({ kind: 'alert_only' }).success).toBe(true);
    expect(AutoActionSchema.safeParse({ kind: 'alert_only', strategy: 'balanced' }).success).toBe(
      false
    );
  });

  it('log line: needs an incident or an action; a grid change logs before and after', () => {
    const ok = { ...entry(), hash: 'h' };
    expect(DispatchLogEntrySchema.safeParse(ok).success).toBe(true);
    expect(
      DispatchLogEntrySchema.safeParse({ ...ok, incident: undefined, action: undefined }).success
    ).toBe(false);
    expect(DispatchLogEntrySchema.safeParse({ ...ok, after: undefined }).success).toBe(false);
    const alert = { ...ok, action: { kind: 'alert_only' }, before: undefined, after: undefined };
    expect(DispatchLogEntrySchema.safeParse(alert).success).toBe(true);
  });
});

describe('dispatchLogHash (PA-T0b)', () => {
  it('is stable, ignores key order and its own hash field', () => {
    const e = entry();
    const reordered = Object.fromEntries(Object.entries(e).reverse()) as typeof e;
    expect(dispatchLogHash(e)).toMatch(/^[0-9a-f]{16}$/);
    expect(dispatchLogHash(reordered)).toBe(dispatchLogHash(e));
    expect(dispatchLogHash({ ...e, hash: 'anything' })).toBe(dispatchLogHash(e));
  });

  it('changes when the line changes', () => {
    expect(dispatchLogHash(entry({ hour: 15 }))).not.toBe(dispatchLogHash(entry()));
  });
});

describe('sortIncidents (PA-T0b)', () => {
  it('most severe first, then earliest; input untouched', () => {
    const lateFire = { ...fire, hour: 16, sector: 'water' as const };
    const input = [surplus, lateFire, fire];
    expect(sortIncidents(input)).toEqual([fire, lateFire, surplus]);
    expect(input).toEqual([surplus, lateFire, fire]);
  });
});
