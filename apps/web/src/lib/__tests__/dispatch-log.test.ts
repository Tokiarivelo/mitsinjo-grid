import { describe, it, expect } from 'vitest';
import { DispatchLogEntrySchema, dispatchLogHash, scenarios, simulate } from '@mitsinjo/engine';
import {
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
