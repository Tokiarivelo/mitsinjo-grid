import { describe, expect, it } from 'vitest';
import type { SectorDemandStep } from '../model/demand';
import {
  runBalancedStrategy,
  runEssentialFirstStrategy,
  runProportionalStrategy,
} from '../strategies';

const mockSectors: SectorDemandStep[] = [
  {
    sectorId: 'health',
    demandKw: 10,
    criticalDemandKw: 8,
    priority: 'critical',
    criticalShare: 0.8,
  },
  {
    sectorId: 'water',
    demandKw: 20,
    criticalDemandKw: 6,
    priority: 'high',
    criticalShare: 0.3,
  },
  {
    sectorId: 'school',
    demandKw: 10,
    criticalDemandKw: 1,
    priority: 'medium',
    criticalShare: 0.1,
  },
  {
    sectorId: 'households',
    demandKw: 40,
    criticalDemandKw: 8,
    priority: 'medium',
    criticalShare: 0.2,
  },
  {
    sectorId: 'market',
    demandKw: 20,
    criticalDemandKw: 2,
    priority: 'low',
    criticalShare: 0.1,
  },
];
// Total demand = 100 kW. Total critical demand = 25 kW.

describe('Strategies (P3-T3, P3-T4, P3-T9)', () => {
  describe('Proportional Strategy', () => {
    it('serves 100% when available >= demand', () => {
      const res = runProportionalStrategy(120, mockSectors);
      expect(res.health.servedKw).toBe(10);
      expect(res.health.criticalServedKw).toBe(8);
      expect(res.water.servedKw).toBe(20);
      expect(res.households.servedKw).toBe(40);
    });

    it('scales all sectors down by equal ratio when available < demand', () => {
      // 50 kW available vs 100 kW demand -> 50% ratio
      const res = runProportionalStrategy(50, mockSectors);
      expect(res.health.servedKw).toBe(5);
      expect(res.health.criticalServedKw).toBe(5); // min(5, 8)
      expect(res.water.servedKw).toBe(10);
      expect(res.water.criticalServedKw).toBe(6); // min(10, 6)
      expect(res.households.servedKw).toBe(20);
      expect(res.market.servedKw).toBe(10);

      const totalServed = Object.values(res).reduce((acc, s) => acc + s.servedKw, 0);
      expect(totalServed).toBeCloseTo(50, 6);
    });

    it('returns zero for all sectors when available is 0', () => {
      const res = runProportionalStrategy(0, mockSectors);
      for (const sec of Object.values(res)) {
        expect(sec.servedKw).toBe(0);
        expect(sec.criticalServedKw).toBe(0);
      }
    });
  });

  describe('Essential First Strategy', () => {
    it('serves critical tier first, then high, before medium gets anything', () => {
      // 25 kW available:
      // health (critical, 10 kW) gets 10 kW -> 15 kW left
      // water (high, 20 kW) gets remaining 15 kW (75%) -> 0 kW left
      // school, households (medium), market (low) get 0 kW
      const res = runEssentialFirstStrategy(25, mockSectors);

      expect(res.health.servedKw).toBe(10);
      expect(res.health.criticalServedKw).toBe(8);

      expect(res.water.servedKw).toBe(15);
      expect(res.water.criticalServedKw).toBe(6);

      expect(res.school.servedKw).toBe(0);
      expect(res.households.servedKw).toBe(0);
      expect(res.market.servedKw).toBe(0);

      const totalServed = Object.values(res).reduce((acc, s) => acc + s.servedKw, 0);
      expect(totalServed).toBeCloseTo(25, 6);
    });

    it('shares proportionally within same priority tier when tier is partially served', () => {
      // health (10 kW) + water (20 kW) = 30 kW.
      // 50 kW available -> 20 kW left for medium tier.
      // Medium tier has: school (10 kW) + households (40 kW) = 50 kW demand.
      // Ratio for medium tier = 20 / 50 = 0.4.
      // school gets 10 * 0.4 = 4 kW.
      // households gets 40 * 0.4 = 16 kW.
      // market (low tier) gets 0 kW.
      const res = runEssentialFirstStrategy(50, mockSectors);

      expect(res.health.servedKw).toBe(10);
      expect(res.water.servedKw).toBe(20);
      expect(res.school.servedKw).toBeCloseTo(4, 6);
      expect(res.households.servedKw).toBeCloseTo(16, 6);
      expect(res.market.servedKw).toBe(0);

      const totalServed = Object.values(res).reduce((acc, s) => acc + s.servedKw, 0);
      expect(totalServed).toBeCloseTo(50, 6);
    });
  });

  describe('Balanced Strategy (stretch)', () => {
    it('guarantees critical share of all sectors in Pass 1', () => {
      // Total critical demand is 25 kW.
      // With 25 kW available, every sector gets exactly its critical demand:
      const res = runBalancedStrategy(25, mockSectors);

      expect(res.health.servedKw).toBeCloseTo(8, 6);
      expect(res.health.criticalServedKw).toBeCloseTo(8, 6);

      expect(res.water.servedKw).toBeCloseTo(6, 6);
      expect(res.water.criticalServedKw).toBeCloseTo(6, 6);

      expect(res.school.servedKw).toBeCloseTo(1, 6);
      expect(res.households.servedKw).toBeCloseTo(8, 6);
      expect(res.market.servedKw).toBeCloseTo(2, 6);

      const totalServed = Object.values(res).reduce((acc, s) => acc + s.servedKw, 0);
      expect(totalServed).toBeCloseTo(25, 6);
    });

    it('water-fills remaining demand by priority weight in Pass 2', () => {
      // 50 kW available:
      // Pass 1: 25 kW to critical shares of all sectors.
      // Pass 2: 25 kW remaining distributed among remaining demands by priority weights.
      const res = runBalancedStrategy(50, mockSectors);

      // In balanced, health had 2 kW non-critical left, priority weight 4.
      expect(res.health.servedKw).toBeGreaterThan(8);
      expect(res.water.servedKw).toBeGreaterThan(6);
      expect(res.households.servedKw).toBeGreaterThan(8);

      const totalServed = Object.values(res).reduce((acc, s) => acc + s.servedKw, 0);
      expect(totalServed).toBeCloseTo(50, 6);
    });

    it('never exceeds sector demand under balanced strategy', () => {
      const res = runBalancedStrategy(200, mockSectors);
      for (const s of mockSectors) {
        expect(res[s.sectorId].servedKw).toBeCloseTo(s.demandKw, 6);
      }
    });
  });
});
