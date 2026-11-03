// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { executeTool } from '../tools';
import { scenarios, type DispatchLogEntry } from '@mitsinjo/engine';
import { sealLogEntry } from '@/lib/dispatch-log';

vi.mock('server-only', () => ({}));

describe('Copilot tool get_dispatch_log (PA-T5b)', () => {
  const baseInput = scenarios.baseline.input;

  const mockLog: DispatchLogEntry[] = [
    sealLogEntry({
      id: 'log-1',
      day: 0,
      hour: 14,
      mode: 'autonomous',
      origin: 'ai',
      incident: {
        kind: 'fire',
        severity: 'critical',
        day: 0,
        hour: 14,
        sector: 'market',
        evidence: { activeFire: 1 },
      },
      action: {
        kind: 'isolate_sector',
        sector: 'market',
        answers: 'fire',
        patch: { sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 14, toHour: 24 }] },
      },
      before: {
        resultId: 'r1',
        unservedKwh: 50,
        criticalUnservedKwh: 12,
        socEndPct: 40,
      },
      after: {
        resultId: 'r2',
        unservedKwh: 30,
        criticalUnservedKwh: 0,
        socEndPct: 48,
      },
      narration: {
        text: 'À 14:00, incendie au marché : secteur isolé avec succès.',
        source: 'llm',
      },
    }),
    sealLogEntry({
      id: 'log-2',
      day: 0,
      hour: 17,
      mode: 'autonomous',
      origin: 'ai',
      incident: {
        kind: 'overload',
        severity: 'warning',
        day: 0,
        hour: 17,
        evidence: { demandKw: 42 },
      },
      action: {
        kind: 'shed_flexible',
        sector: 'industry',
        patch: { sectorCaps: [{ sector: 'industry', maxKw: 0, fromHour: 17, toHour: 20 }] },
      },
      before: {
        resultId: 'r3',
        unservedKwh: 20,
        criticalUnservedKwh: 0,
        socEndPct: 35,
      },
      after: {
        resultId: 'r4',
        unservedKwh: 15,
        criticalUnservedKwh: 0,
        socEndPct: 38,
      },
    }),
  ];

  it('retrieves all entries when no filter is provided', () => {
    const res = executeTool(
      'get_dispatch_log',
      {},
      {
        input: baseInput,
        dispatchLog: mockLog,
      }
    );

    expect(res.error).toBeUndefined();
    expect(res.data?.totalEntries).toBe(2);
    expect(res.data?.actionsCount).toBe(2);
    expect(res.data?.criticalCount).toBe(1);
    expect(res.data?.totalSavedKwh).toBe(25); // (50-30) + (20-15)
    expect(res.evidence?.totalSavedKwh).toBe(25);
  });

  it('filters entries by sector', () => {
    const res = executeTool(
      'get_dispatch_log',
      { sector: 'market' },
      {
        input: baseInput,
        dispatchLog: mockLog,
      }
    );

    expect(res.error).toBeUndefined();
    expect(res.data?.totalEntries).toBe(1);
    const entries = res.data?.entries as Array<{ sector?: string; action?: { sector?: string } }>;
    expect(entries[0]?.action?.sector).toBe('market');
  });

  it('filters entries by hour', () => {
    const res = executeTool(
      'get_dispatch_log',
      { hour: 17 },
      {
        input: baseInput,
        dispatchLog: mockLog,
      }
    );

    expect(res.error).toBeUndefined();
    expect(res.data?.totalEntries).toBe(1);
    const entries = res.data?.entries as Array<{ hour: number }>;
    expect(entries[0]?.hour).toBe(17);
  });

  it('filters entries by severity', () => {
    const res = executeTool(
      'get_dispatch_log',
      { severity: 'critical' },
      {
        input: baseInput,
        dispatchLog: mockLog,
      }
    );

    expect(res.error).toBeUndefined();
    expect(res.data?.totalEntries).toBe(1);
    const entries = res.data?.entries as Array<{ incident?: { severity: string } }>;
    expect(entries[0]?.incident?.severity).toBe('critical');
  });

  it('rejects invalid parameters with human-readable error', () => {
    const res = executeTool(
      'get_dispatch_log',
      { hour: 99 },
      {
        input: baseInput,
        dispatchLog: mockLog,
      }
    );

    expect(res.error).toBeDefined();
    expect(res.error).toContain('hour');
  });
});
