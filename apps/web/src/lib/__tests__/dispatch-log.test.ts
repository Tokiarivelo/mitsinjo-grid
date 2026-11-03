import { describe, it, expect } from 'vitest';
import {
  DispatchLogEntrySchema,
  detectIncidents,
  dispatchLogHash,
  scenarios,
  simulate,
} from '@mitsinjo/engine';
import {
  criticalSectorIncidents,
  dispatchLogToCsv,
  entrySavedKwh,
  entrySector,
  operatorAutoAction,
  operatorLogEntry,
  resultSnapshot,
  sealLogEntry,
} from '../dispatch-log';

const input = scenarios.village_fire.input;

describe('dispatch-log helpers (PA-T3c)', () => {
  it('sealLogEntry adds the reproducible audit hash', () => {
    const draft = {
      id: 'x',
      day: 0,
      hour: 3,
      mode: 'autonomous' as const,
      origin: 'ai' as const,
      action: { kind: 'alert_only' as const },
    };
    expect(sealLogEntry(draft).hash).toBe(dispatchLogHash(draft));
  });

  it('resultSnapshot copies engine metrics as they are', () => {
    const r = simulate(input, 'proportional');
    expect(resultSnapshot(r)).toEqual({
      resultId: r.id,
      unservedKwh: r.metrics.unservedKwh,
      criticalUnservedKwh: r.metrics.criticalUnservedKwh,
      socEndPct: r.metrics.socEndPct,
    });
  });

  it.each([
    [
      'sector cap',
      {
        patch: { sectorCaps: [{ sector: 'market' as const, maxKw: 0, fromHour: 18, toHour: 22 }] },
      },
      'cap_sector',
    ],
    ['strategy', { strategy: 'essential_first' as const }, 'switch_strategy'],
    ['lifeline floor', { patch: { lifeline: { kw: { health: 1 } } } }, 'raise_clinic_floor'],
  ])('maps a compliant %s proposal to an action', (_, proposal, kind) => {
    expect(operatorAutoAction(input, proposal)?.kind).toBe(kind);
  });

  it.each([
    [
      'cuts the clinic',
      {
        patch: { sectorCaps: [{ sector: 'health' as const, maxKw: 0, fromHour: 18, toHour: 22 }] },
      },
    ],
    ['lowers the clinic floor', { patch: { lifeline: { kw: { health: 0.1 } } } }],
    ['turns the lifeline off', { patch: { lifeline: { enabled: false } } }],
    [
      'clears a fire (re-energises a burning sector)',
      { patch: { clearFires: ['market' as const] } },
    ],
    ['fits no action kind', { patch: { demandMultiplier: 0.8 } }],
  ])('needs the operator when the proposal %s', (_, proposal) => {
    expect(operatorAutoAction(input, proposal)).toBeNull();
  });

  it('operatorLogEntry is a valid, hashed operator line with engine before/after', () => {
    const before = simulate(input, 'proportional');
    const after = simulate(input, 'essential_first');
    const entry = operatorLogEntry({
      id: 'op-1',
      day: 0,
      hour: 18,
      action: { kind: 'switch_strategy', strategy: 'essential_first' },
      before,
      after,
      reason: 'x'.repeat(500),
    });
    expect(DispatchLogEntrySchema.parse(entry)).toEqual(entry);
    expect(entry.origin).toBe('operator');
    expect(entry.after?.resultId).toBe(after.id);
    expect(entry.narration?.text).toHaveLength(400);
    const { hash, ...draft } = entry;
    expect(hash).toBe(dispatchLogHash(draft));
  });
});

describe('dispatch-log view helpers (PA-T4b/c)', () => {
  const snap = (unservedKwh: number, socEndPct: number) => ({
    resultId: 'r',
    unservedKwh,
    criticalUnservedKwh: 0,
    socEndPct,
  });
  const action = sealLogEntry({
    id: 'a1',
    day: 0,
    hour: 14,
    mode: 'autonomous',
    origin: 'ai',
    action: { kind: 'cap_sector', sector: 'market', patch: { sectorCaps: [] } } as never,
    before: snap(5, 40),
    after: snap(3.5, 42),
    narration: { text: 'Cap market, "peak", now', source: 'llm' },
  });
  const incident = sealLogEntry({
    id: 'i1',
    day: 0,
    hour: 14,
    mode: 'autonomous',
    origin: 'ai',
    incident: {
      kind: 'fire',
      severity: 'critical',
      sector: 'water',
      hour: 14,
      evidence: {},
    } as never,
  });

  it('entrySector prefers the incident sector, else the action sector', () => {
    expect(entrySector(action)).toBe('market');
    expect(entrySector(incident)).toBe('water');
  });

  it('entrySavedKwh is the engine before − after, never negative, 0 without figures', () => {
    expect(entrySavedKwh(action)).toBeCloseTo(1.5);
    expect(entrySavedKwh(incident)).toBe(0);
    expect(entrySavedKwh({ ...action, before: snap(1, 40), after: snap(2, 40) })).toBe(0);
  });

  it('dispatchLogToCsv writes a header + one row per line and escapes quotes/commas', () => {
    const lines = dispatchLogToCsv([action, incident]).split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]!.startsWith('id,day,hour,mode,origin,type,severity,kind,sector')).toBe(true);
    expect(lines[1]).toContain(',action,,cap_sector,market,5,3.5,0,0,40,42,');
    expect(lines[1]).toContain('"Cap market, ""peak"", now"');
    expect(lines[2]).toContain(',incident,critical,fire,water,');
  });

  it('criticalSectorIncidents keeps only critical incidents tied to a sector', () => {
    const fire = scenarios.village_fire.input;
    const r = simulate(fire, 'proportional');
    for (let h = 0; h < 24; h++) {
      const all = detectIncidents(fire, r, h, 3, 0);
      const crit = criticalSectorIncidents(fire, r, h);
      expect(crit).toEqual(all.filter((i) => i.severity === 'critical' && i.sector));
    }
    expect(criticalSectorIncidents(fire, r, 14).some((i) => i.kind === 'fire')).toBe(true);
  });
});
