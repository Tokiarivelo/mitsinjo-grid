import { describe, expect, it } from 'vitest';
import {
  AutoActionSchema,
  DispatchLogEntrySchema,
  DispatchModeSchema,
  IncidentSchema,
  detectIncidents,
  dispatchLogHash,
  scenarios,
  simulate,
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

describe('detectIncidents (PA-T1)', () => {
  it('village_fire scenario detects market fire at 14h and market + water fire at 15h', () => {
    const sim = simulate(scenarios.village_fire.input, 'essential_first');

    // Before fire (13h): no fire incidents
    const inc13 = detectIncidents(scenarios.village_fire.input, sim, 13);
    expect(inc13.filter((i) => i.kind === 'fire')).toHaveLength(0);

    // Fire starts on market at 14h
    const inc14 = detectIncidents(scenarios.village_fire.input, sim, 14);
    const fires14 = inc14.filter((i) => i.kind === 'fire');
    expect(fires14).toHaveLength(1);
    expect(fires14[0]?.sector).toBe('market');
    expect(fires14[0]?.severity).toBe('critical');

    // Fire spreads to water at 15h
    const inc15 = detectIncidents(scenarios.village_fire.input, sim, 15);
    const fires15 = inc15.filter((i) => i.kind === 'fire');
    expect(fires15).toHaveLength(2);
    expect(fires15.map((f) => f.sector)).toEqual(['market', 'water']);
    expect(fires15.every((f) => f.severity === 'critical')).toBe(true);
  });

  it('high_demand scenario detects overload and demand_surge during 17–22h only', () => {
    const sim = simulate(scenarios.high_demand.input, 'essential_first');

    // Before spike (< 17h)
    expect(detectIncidents(scenarios.high_demand.input, sim, 16)).toHaveLength(0);

    // During spike (17h to 21h, 17–22h event)
    for (let h = 17; h < 22; h++) {
      const inc = detectIncidents(scenarios.high_demand.input, sim, h);
      const overload = inc.find((i) => i.kind === 'overload');
      const surges = inc.filter((i) => i.kind === 'demand_surge');

      expect(overload).toBeDefined();
      expect(overload?.severity).toBe('warning');
      expect(surges.length).toBeGreaterThan(0);
      expect(surges.every((s) => s.severity === 'warning')).toBe(true);
    }

    // After spike (>= 22h)
    expect(detectIncidents(scenarios.high_demand.input, sim, 22)).toHaveLength(0);
    expect(detectIncidents(scenarios.high_demand.input, sim, 23)).toHaveLength(0);
  });

  it('baseline scenario detects solar_surplus at midi (12h) only', () => {
    const sim = simulate(scenarios.baseline.input, 'essential_first');

    // Noon has peak solar surplus
    const noonIncidents = detectIncidents(scenarios.baseline.input, sim, 12);
    expect(noonIncidents).toHaveLength(1);
    expect(noonIncidents[0]?.kind).toBe('solar_surplus');
    expect(noonIncidents[0]?.severity).toBe('info');

    // Non-noon hours have no solar_surplus
    for (const h of [0, 6, 9, 10, 11, 13, 14, 18, 23]) {
      const inc = detectIncidents(scenarios.baseline.input, sim, h);
      expect(inc.some((i) => i.kind === 'solar_surplus')).toBe(false);
    }
  });

  it('battery_constraint detects critical_forecast, lifeline_shortfall, and reserve_low', () => {
    const sim = simulate(scenarios.battery_constraint.input, 'proportional');

    // Hour 1: battery reserve low + upcoming critical shortfall forecast
    const inc1 = detectIncidents(scenarios.battery_constraint.input, sim, 1);
    expect(inc1.some((i) => i.kind === 'critical_forecast')).toBe(true);
    expect(inc1.some((i) => i.kind === 'reserve_low')).toBe(true);

    // Hour 3: active overload and lifeline shortfall
    const inc3 = detectIncidents(scenarios.battery_constraint.input, sim, 3);
    expect(inc3.some((i) => i.kind === 'overload')).toBe(true);
    expect(inc3.some((i) => i.kind === 'lifeline_shortfall')).toBe(true);
    expect(inc3.some((i) => i.kind === 'reserve_low')).toBe(true);
  });

  it('meter_anomaly scenario detects meter_anomaly during divergence window', () => {
    const sim = simulate(scenarios.meter_anomaly.input, 'proportional');

    const inc12 = detectIncidents(scenarios.meter_anomaly.input, sim, 12);
    const anomaly = inc12.find((i) => i.kind === 'meter_anomaly');
    expect(anomaly).toBeDefined();
    expect(anomaly?.sector).toBe('market');
    expect(anomaly?.severity).toBe('info');
  });

  it('handles invalid hours and sorts results strictly by severity', () => {
    const sim = simulate(scenarios.baseline.input, 'essential_first');
    expect(detectIncidents(scenarios.baseline.input, sim, -1)).toEqual([]);
    expect(detectIncidents(scenarios.baseline.input, sim, 24)).toEqual([]);

    const simStress = simulate(scenarios.battery_constraint.input, 'proportional');
    const inc = detectIncidents(scenarios.battery_constraint.input, simStress, 3);

    // Verify all incidents conform to IncidentSchema
    for (const item of inc) {
      expect(IncidentSchema.safeParse(item).success).toBe(true);
    }

    // Verify sorted by severity: critical before warning before info
    const severities = inc.map((i) => i.severity);
    const rank = (s: string) => (s === 'critical' ? 0 : s === 'warning' ? 1 : 2);
    for (let i = 1; i < severities.length; i++) {
      expect(rank(severities[i]!)).toBeGreaterThanOrEqual(rank(severities[i - 1]!));
    }
  });
});
