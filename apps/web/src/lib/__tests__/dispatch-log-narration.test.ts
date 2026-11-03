import { describe, it, expect } from 'vitest';
import {
  sealLogEntry,
  formatTemplateNarration,
  isNarrationFactual,
  computeShiftReport,
  extractNumbersFromText,
} from '../dispatch-log';
import type { DispatchLogEntry } from '@mitsinjo/engine';

describe('Dispatch narration & shift report (PA-T5a, PA-T5c)', () => {
  const fireEntry: DispatchLogEntry = sealLogEntry({
    id: 'test-fire-14',
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
      unservedKwh: 45.5,
      criticalUnservedKwh: 10.0,
      socEndPct: 40,
    },
    after: {
      resultId: 'r2',
      unservedKwh: 20.0,
      criticalUnservedKwh: 0.0,
      socEndPct: 55,
    },
  });

  describe('formatTemplateNarration', () => {
    it('produces localized sentences for fire isolation', () => {
      const fr = formatTemplateNarration(fireEntry, 'fr');
      expect(fr).toContain('14:00');
      expect(fr).toContain('marché');
      expect(fr).toContain('isolé');
      expect(fr).toContain('25.50 kWh');

      const en = formatTemplateNarration(fireEntry, 'en');
      expect(en).toContain('14:00');
      expect(en).toContain('market');
      expect(en).toContain('isolated');
      expect(en).toContain('25.50 kWh saved');

      const mg = formatTemplateNarration(fireEntry, 'mg');
      expect(mg).toContain('14:00');
      expect(mg).toContain('tsena');
      expect(mg).toContain('najanona');
    });

    it('handles operator requested actions', () => {
      const opEntry: DispatchLogEntry = sealLogEntry({
        id: 'test-op-10',
        day: 0,
        hour: 10,
        mode: 'autonomous',
        origin: 'operator',
        action: {
          kind: 'switch_strategy',
          strategy: 'essential_first',
        },
      });
      const fr = formatTemplateNarration(opEntry, 'fr');
      expect(fr).toContain('opérateur');
      expect(fr).toContain('10:00');
    });
  });

  describe('isNarrationFactual (PA-T5a no hallucinations)', () => {
    it('approves text with legitimate figures from evidence/before/after', () => {
      const factualText =
        'À 14:00, isolation du marché permettant de préserver 25.50 kWh et un SoC de 55%.';
      expect(isNarrationFactual(factualText, fireEntry)).toBe(true);
    });

    it('rejects text with invented metrics or numbers', () => {
      const hallucinated = 'À 14:00, coupure générant une économie magique de 999.00 kWh.';
      expect(isNarrationFactual(hallucinated, fireEntry)).toBe(false);
    });

    it('extracts decimal numbers properly with dot or comma', () => {
      expect(extractNumbersFromText('14h, 25.5 kWh et 10,0 kWh')).toEqual([14, 25.5, 10]);
    });
  });

  describe('computeShiftReport (PA-T5c)', () => {
    it('aggregates incidents, actions, and critical energy saved', () => {
      const entries: DispatchLogEntry[] = [
        fireEntry,
        sealLogEntry({
          id: 'test-warning-16',
          day: 0,
          hour: 16,
          mode: 'autonomous',
          origin: 'ai',
          incident: {
            kind: 'reserve_low',
            severity: 'warning',
            day: 0,
            hour: 16,
            evidence: { socPct: 22 },
          },
          action: {
            kind: 'shed_flexible',
            sector: 'industry',
            patch: { sectorCaps: [{ sector: 'industry', maxKw: 0, fromHour: 16, toHour: 20 }] },
          },
          before: {
            resultId: 'r3',
            unservedKwh: 30,
            criticalUnservedKwh: 0,
            socEndPct: 22,
          },
          after: {
            resultId: 'r4',
            unservedKwh: 25,
            criticalUnservedKwh: 0,
            socEndPct: 30,
          },
        }),
      ];

      const report = computeShiftReport(entries, 0);
      expect(report.day).toBe(0);
      expect(report.totalIncidents).toBe(2);
      expect(report.criticalIncidents).toBe(1);
      expect(report.warningIncidents).toBe(1);
      expect(report.totalActions).toBe(2);
      expect(report.savedKwh).toBe(30.5); // 25.5 + 5.0
      expect(report.criticalSavedKwh).toBe(10.0);
      expect(report.affectedSectors).toContain('market');
      expect(report.affectedSectors).toContain('industry');
      expect(report.keyActions.length).toBe(2);
      expect(report.keyActions[0]?.actionKind).toBe('isolate_sector'); // higher saved kwh first
    });
  });
});
