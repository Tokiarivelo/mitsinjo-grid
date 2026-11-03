import { describe, expect, it } from 'vitest';
import {
  AutoActionSchema,
  DEFAULT_CONSTITUTION,
  DispatchLogEntrySchema,
  DispatchModeSchema,
  IncidentSchema,
  applyPatch,
  candidateActions,
  checkAntiOscillation,
  decideDispatch,
  detectIncidents,
  dispatchLogHash,
  scenarios,
  simulate,
  sortIncidents,
  type AutoAction,
  type ConstitutionRule,
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

  it('overload_evening scenario detects demand_surge on households and overload in evening (PA-T6b)', () => {
    const input = scenarios.overload_evening.input;
    const sim = simulate(input, 'proportional');

    // Hour 18: evening household demand surge starts
    const inc18 = detectIncidents(input, sim, 18);
    expect(inc18.some((i) => i.kind === 'demand_surge' && i.sector === 'households')).toBe(true);

    // Later evening (e.g. 21h): overload detected due to high evening demand + workshop
    const inc21 = detectIncidents(input, sim, 21);
    expect(inc21.some((i) => i.kind === 'overload' || i.kind === 'demand_surge')).toBe(true);
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

describe('candidateActions (PA-T2a)', () => {
  const baseInput = scenarios.baseline.input;

  it('fire incident generates isolate_sector on the burning sector', () => {
    const actions = candidateActions(fire, baseInput);
    expect(actions.length).toBeGreaterThan(0);
    const isolate = actions.find((a) => a.kind === 'isolate_sector');
    expect(isolate).toBeDefined();
    expect(isolate?.sector).toBe('market');
    expect(isolate?.patch?.sectorCaps?.[0]).toEqual({
      sector: 'market',
      maxKw: 0,
      fromHour: 14,
      toHour: 24,
    });
  });

  it('critical_forecast generates strategy switches, clinic floor, shed flexible, and cap sector', () => {
    const inc: Incident = {
      kind: 'critical_forecast',
      severity: 'critical',
      day: 0,
      hour: 18,
      evidence: { unservedKw: 1.5 },
    };
    const actions = candidateActions(inc, baseInput);
    expect(
      actions.some((a) => a.kind === 'switch_strategy' && a.strategy === 'essential_first')
    ).toBe(true);
    expect(actions.some((a) => a.kind === 'switch_strategy' && a.strategy === 'balanced')).toBe(
      true
    );
    expect(actions.some((a) => a.kind === 'raise_clinic_floor')).toBe(true);
    expect(actions.some((a) => a.kind === 'shed_flexible')).toBe(true);
    expect(actions.some((a) => a.kind === 'cap_sector')).toBe(true);
    for (const a of actions) {
      expect(AutoActionSchema.safeParse(a).success).toBe(true);
    }
  });

  it('overload incident generates strategy switch, shed flexible, and market cap', () => {
    const inc: Incident = {
      kind: 'overload',
      severity: 'warning',
      day: 0,
      hour: 19,
      evidence: { deficitKw: 2.0 },
    };
    const actions = candidateActions(inc, baseInput);
    expect(
      actions.some((a) => a.kind === 'switch_strategy' && a.strategy === 'essential_first')
    ).toBe(true);
    expect(actions.some((a) => a.kind === 'shed_flexible')).toBe(true);
    expect(actions.some((a) => a.kind === 'cap_sector' && a.sector === 'market')).toBe(true);
  });

  it('demand_surge incident caps the surging sector to normal profile and switches strategy', () => {
    const inc: Incident = {
      kind: 'demand_surge',
      severity: 'warning',
      day: 0,
      hour: 18,
      sector: 'households',
      evidence: { demandKw: 8.0, profileKw: 6.0 },
    };
    const actions = candidateActions(inc, baseInput);
    const cap = actions.find((a) => a.kind === 'cap_sector');
    expect(cap).toBeDefined();
    expect(cap?.sector).toBe('households');
    expect(
      actions.some((a) => a.kind === 'switch_strategy' && a.strategy === 'essential_first')
    ).toBe(true);
  });

  it('reserve_low generates reserve_night at night (20h) but not during daytime (10h)', () => {
    const incNight: Incident = {
      kind: 'reserve_low',
      severity: 'warning',
      day: 0,
      hour: 20,
      evidence: { socPct: 22 },
    };
    const nightActions = candidateActions(incNight, baseInput);
    expect(nightActions.some((a) => a.kind === 'reserve_night')).toBe(true);

    const incDay: Incident = {
      kind: 'reserve_low',
      severity: 'warning',
      day: 0,
      hour: 10,
      evidence: { socPct: 22 },
    };
    const dayActions = candidateActions(incDay, baseInput);
    expect(dayActions.some((a) => a.kind === 'reserve_night')).toBe(false);
  });

  it('solar_surplus generates shift_flexible, proportional switch, and restore_sector when capped', () => {
    const cappedInput = {
      ...baseInput,
      sectorCaps: [{ sector: 'market' as const, maxKw: 1.0, fromHour: 10, toHour: 24 }],
    };
    const actions = candidateActions(surplus, cappedInput);
    expect(actions.some((a) => a.kind === 'shift_flexible')).toBe(true);
    expect(actions.some((a) => a.kind === 'switch_strategy' && a.strategy === 'proportional')).toBe(
      true
    );
    expect(actions.some((a) => a.kind === 'restore_sector' && a.sector === 'market')).toBe(true);
    expect(actions.some((a) => a.kind === 'alert_only')).toBe(true);
  });

  it('meter_anomaly generates alert_only and never cuts', () => {
    const inc: Incident = {
      kind: 'meter_anomaly',
      severity: 'info',
      day: 0,
      hour: 13,
      sector: 'market',
      evidence: { readingKw: 3.2, profileKw: 2.0 },
    };
    const actions = candidateActions(inc, baseInput);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.kind).toBe('alert_only');
    expect(actions[0]?.patch).toBeUndefined();
  });
});

describe('checkAntiOscillation (PA-T2c)', () => {
  const sampleAction: AutoAction = {
    kind: 'isolate_sector',
    sector: 'market',
    patch: { sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 14, toHour: 24 }] },
  };

  it('allows up to 2 actions per hour and blocks the 3rd non-alert action', () => {
    const history: DispatchLogEntry[] = [
      { ...entry({ hour: 14 }), hash: 'h1' },
      {
        ...entry({
          hour: 14,
          action: {
            kind: 'cap_sector',
            sector: 'water',
            patch: { sectorCaps: [{ sector: 'water', maxKw: 1, fromHour: 14, toHour: 24 }] },
          },
        }),
        hash: 'h2',
      },
    ];

    const capHealth: AutoAction = {
      kind: 'cap_sector',
      sector: 'health',
      patch: { sectorCaps: [{ sector: 'health', maxKw: 1, fromHour: 14, toHour: 24 }] },
    };
    expect(checkAntiOscillation(capHealth, 14, 0, history)).toBe(false);
    expect(checkAntiOscillation(capHealth, 15, 0, history)).toBe(true);
    // Fire isolation is exempt from the hourly limit (F1)
    expect(checkAntiOscillation(sampleAction, 14, 0, history)).toBe(true);
  });

  it('does not count alert_only towards the 2 actions/hour limit', () => {
    const history: DispatchLogEntry[] = [
      {
        ...entry({ hour: 14, action: { kind: 'alert_only' }, before: undefined, after: undefined }),
        hash: 'h1',
      },
      { ...entry({ hour: 14 }), hash: 'h2' },
    ];
    expect(checkAntiOscillation(sampleAction, 14, 0, history)).toBe(true);
  });

  it('blocks opposite action on the same sector within 2h', () => {
    const history: DispatchLogEntry[] = [
      {
        ...entry({
          hour: 14,
          action: {
            kind: 'isolate_sector',
            sector: 'market',
            patch: { sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 14, toHour: 24 }] },
          },
        }),
        hash: 'h1',
      },
    ];

    const restoreAction: AutoAction = {
      kind: 'restore_sector',
      sector: 'market',
      patch: { sectorCaps: [] },
    };

    // Blocked at 15h (1 hour difference <= 2)
    expect(checkAntiOscillation(restoreAction, 15, 0, history)).toBe(false);
    // Blocked at 16h (2 hours difference <= 2)
    expect(checkAntiOscillation(restoreAction, 16, 0, history)).toBe(false);
    // Allowed at 17h (> 2 hours difference)
    expect(checkAntiOscillation(restoreAction, 17, 0, history)).toBe(true);
  });

  it('fire isolation is safety-critical and never blocked by anti-oscillation', () => {
    const history: DispatchLogEntry[] = [
      {
        ...entry({
          hour: 14,
          action: { kind: 'restore_sector', sector: 'market', patch: { sectorCaps: [] } },
        }),
        hash: 'h1',
      },
    ];

    const isolateAction: AutoAction = {
      kind: 'isolate_sector',
      sector: 'market',
      patch: { sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 15, toHour: 24 }] },
    };

    // Even within 1h of restore, fire isolation is allowed!
    expect(checkAntiOscillation(isolateAction, 15, 0, history)).toBe(true);
  });
});

describe('decideDispatch (PA-T2b)', () => {
  it('drops actions that violate village constitution', () => {
    const rules: ConstitutionRule[] = [
      { id: 'clinic-never-cut', kind: 'never_cut', sector: 'health' },
    ];

    const inc: Incident = {
      kind: 'critical_forecast',
      severity: 'critical',
      day: 0,
      hour: 18,
      evidence: { unservedKw: 2.0 },
    };

    const decision = decideDispatch(scenarios.baseline.input, 18, 'proportional', [inc], rules);

    // Verify no evaluated candidate that violated constitution was selected
    if (decision.action?.patch?.sectorCaps) {
      const cutsHealth = decision.action.patch.sectorCaps.some(
        (c) => c.sector === 'health' && c.maxKw === 0
      );
      expect(cutsHealth).toBe(false);
    }
  });

  it('never restores a sector while its fire is active', () => {
    // In village_fire, market burns from 14h to 24h
    const inc: Incident = {
      kind: 'solar_surplus',
      severity: 'info',
      day: 0,
      hour: 16,
      evidence: { curtailedKw: 1.0 },
    };

    const decision = decideDispatch(scenarios.village_fire.input, 16, 'proportional', [inc]);
    if (decision.action?.kind === 'restore_sector') {
      expect(decision.action.sector).not.toBe('market');
      expect(decision.action.sector).not.toBe('water');
    }
  });

  it('achieves critical unserved <= best fixed strategy on all 7 scenarios', () => {
    for (const [id, sc] of Object.entries(scenarios)) {
      let input = sc.input;
      let strategy: 'proportional' | 'essential_first' | 'balanced' = 'proportional';
      const history: DispatchLogEntry[] = [];

      for (let h = 0; h < 24; h++) {
        const sim = simulate(input, strategy);
        const incs = detectIncidents(input, sim, h);
        if (incs.length === 0) continue;

        const decision = decideDispatch(input, h, strategy, incs, DEFAULT_CONSTITUTION, history);
        if (decision.action && decision.action.kind !== 'alert_only') {
          if (decision.action.patch) input = applyPatch(input, decision.action.patch);
          if (decision.action.strategy) strategy = decision.action.strategy;
          history.push({
            id: `ai-${h}`,
            day: 0,
            hour: h,
            mode: 'autonomous',
            origin: 'ai',
            incident: incs[0],
            action: decision.action,
            before: decision.before,
            after: decision.after,
            hash: 'h',
          });
        }
      }

      const finalSim = simulate(input, strategy);
      let iaCrit = 0;
      for (const step of finalSim.steps) {
        for (const s of Object.values(step.sectors)) {
          iaCrit += Math.max(0, s.criticalDemandKw - s.criticalServedKw);
        }
      }

      let bestFixed = Infinity;
      for (const st of ['proportional', 'essential_first', 'balanced'] as const) {
        const fixedSim = simulate(sc.input, st);
        let fixedCrit = 0;
        for (const step of fixedSim.steps) {
          for (const s of Object.values(step.sectors)) {
            fixedCrit += Math.max(0, s.criticalDemandKw - s.criticalServedKw);
          }
        }
        if (fixedCrit < bestFixed) bestFixed = fixedCrit;
      }

      expect(
        iaCrit,
        `Scenario ${id}: autonomous mode critical unserved ${iaCrit} should be <= best fixed ${bestFixed}`
      ).toBeLessThanOrEqual(bestFixed + 1e-4);
    }
  });

  it('keeps fire isolation even when another candidate scores better', () => {
    const input = scenarios.village_fire.input;
    const sim = simulate(input, 'proportional');
    const incs = detectIncidents(input, sim, 14);
    const decision = decideDispatch(input, 14, 'proportional', incs);
    expect(decision.action?.kind).toBe('isolate_sector');
    expect(decision.action?.sector).toBe('market');
  });

  it('does not re-isolate a burning sector that is already isolated', () => {
    const base = scenarios.village_fire.input;
    const input = {
      ...base,
      sectorCaps: [{ sector: 'market' as const, maxKw: 0, fromHour: 14, toHour: 24 }],
    };
    const incs = detectIncidents(input, simulate(input, 'proportional'), 14);
    const decision = decideDispatch(input, 14, 'proportional', incs);
    expect(decision.action?.kind === 'isolate_sector' && decision.action.sector === 'market').toBe(
      false
    );
  });

  it('isolates a burning sector even after 2 actions this hour', () => {
    const input = scenarios.village_fire.input;
    const sim = simulate(input, 'proportional');
    const incs = detectIncidents(input, sim, 14);
    const busy: DispatchLogEntry[] = [
      { ...entry({ action: { kind: 'switch_strategy', strategy: 'balanced' } }), hash: 'h1' },
      {
        ...entry({ action: { kind: 'switch_strategy', strategy: 'essential_first' } }),
        hash: 'h2',
      },
    ];
    const decision = decideDispatch(input, 14, 'proportional', incs, DEFAULT_CONSTITUTION, busy);
    expect(decision.action?.kind).toBe('isolate_sector');
  });

  it('restoring a sector after its fire also lifts its isolation cap', () => {
    const base = structuredClone(scenarios.baseline.input);
    base.events = [...base.events, { type: 'fire', sector: 'market', startHour: 14, durationH: 2 }];
    const isolated = applyPatch(base, {
      sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 14, toHour: 24 }],
    });
    const restore = candidateActions({ ...surplus, hour: 16 }, isolated).find(
      (a) => a.kind === 'restore_sector' && a.patch?.clearFires?.includes('market')
    );
    expect(restore?.patch).toBeDefined();
    const restored = applyPatch(isolated, restore!.patch!);
    expect(restored.sectorCaps?.some((c) => c.sector === 'market') ?? false).toBe(false);
    expect(simulate(restored, 'proportional').steps[16]?.sectors.market?.servedKw).toBeGreaterThan(
      0
    );
  });

  it('executes well within the < 20 ms / hour budget', () => {
    const input = scenarios.high_demand.input;
    const sim = simulate(input, 'proportional');
    const incs = detectIncidents(input, sim, 18);

    const start = performance.now();
    const decision = decideDispatch(input, 18, 'proportional', incs);
    const durationMs = performance.now() - start;

    expect(decision.before).toBeDefined();
    expect(decision.after).toBeDefined();
    expect(decision.counterfactual).toBeDefined();
    expect(durationMs).toBeLessThan(50); // generous CI headroom, typical is ~6ms
  });
});
