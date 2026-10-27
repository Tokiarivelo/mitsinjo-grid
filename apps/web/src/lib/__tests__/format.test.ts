import { describe, expect, it } from 'vitest';
import { EMPTY_PLACEHOLDER, fmtDeltaPct, fmtHour, fmtKw, fmtKwh, fmtPct } from '../format';

describe('format utilities (P4-T2)', () => {
  describe('fmtKw', () => {
    it('formats valid positive numbers with default 1 decimal place', () => {
      expect(fmtKw(40.234)).toBe('40.2 kW');
      expect(fmtKw(0)).toBe('0.0 kW');
    });

    it('formats with custom decimal precision', () => {
      expect(fmtKw(40.234, 2)).toBe('40.23 kW');
      expect(fmtKw(40.234, 0)).toBe('40 kW');
    });

    it('handles null, undefined, NaN, and Infinity with fallback', () => {
      expect(fmtKw(null)).toBe(EMPTY_PLACEHOLDER);
      expect(fmtKw(undefined)).toBe(EMPTY_PLACEHOLDER);
      expect(fmtKw(NaN)).toBe(EMPTY_PLACEHOLDER);
      expect(fmtKw(Infinity)).toBe(EMPTY_PLACEHOLDER);
      expect(fmtKw(null, 1, 'N/A')).toBe('N/A');
    });
  });

  describe('fmtKwh', () => {
    it('formats valid energy values with kWh unit', () => {
      expect(fmtKwh(124.56)).toBe('124.6 kWh');
      expect(fmtKwh(0)).toBe('0.0 kWh');
      expect(fmtKwh(500, 0)).toBe('500 kWh');
    });

    it('handles null, undefined, NaN with fallback', () => {
      expect(fmtKwh(null)).toBe(EMPTY_PLACEHOLDER);
      expect(fmtKwh(undefined)).toBe(EMPTY_PLACEHOLDER);
      expect(fmtKwh(NaN)).toBe(EMPTY_PLACEHOLDER);
    });
  });

  describe('fmtPct', () => {
    it('formats valid percentages with % unit', () => {
      expect(fmtPct(100)).toBe('100.0%');
      expect(fmtPct(98.54, 1)).toBe('98.5%');
      expect(fmtPct(0)).toBe('0.0%');
      expect(fmtPct(75.5, 0)).toBe('76%');
    });

    it('handles null, undefined, NaN with fallback', () => {
      expect(fmtPct(null)).toBe(EMPTY_PLACEHOLDER);
      expect(fmtPct(undefined)).toBe(EMPTY_PLACEHOLDER);
      expect(fmtPct(NaN)).toBe(EMPTY_PLACEHOLDER);
    });
  });

  describe('fmtHour', () => {
    it('formats hour indices into 24h clock strings', () => {
      expect(fmtHour(0)).toBe('00:00');
      expect(fmtHour(9)).toBe('09:00');
      expect(fmtHour(13)).toBe('13:00');
      expect(fmtHour(23)).toBe('23:00');
    });

    it('clamps out of bounds hours', () => {
      expect(fmtHour(25)).toBe('23:00');
      expect(fmtHour(-2)).toBe('00:00');
    });

    it('handles null and NaN', () => {
      expect(fmtHour(null)).toBe(EMPTY_PLACEHOLDER);
      expect(fmtHour(NaN)).toBe(EMPTY_PLACEHOLDER);
    });
  });

  describe('fmtDeltaPct', () => {
    it('prepends + for positive values and - for negative values', () => {
      expect(fmtDeltaPct(12.4)).toBe('+12.4%');
      expect(fmtDeltaPct(-40.0)).toBe('-40.0%');
      expect(fmtDeltaPct(0)).toBe('0.0%');
    });

    it('handles null, undefined, NaN with fallback', () => {
      expect(fmtDeltaPct(null)).toBe(EMPTY_PLACEHOLDER);
      expect(fmtDeltaPct(NaN)).toBe(EMPTY_PLACEHOLDER);
    });
  });
});
