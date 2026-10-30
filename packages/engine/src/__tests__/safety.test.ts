import { describe, expect, it } from 'vitest';
import { clinicGuard } from '../safety';

describe('clinicGuard (M1-T2, K6)', () => {
  it('returns no reason for a safe patch or no patch', () => {
    expect(clinicGuard(undefined)).toEqual([]);
    expect(
      clinicGuard({ sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 18, toHour: 22 }] })
    ).toEqual([]);
    expect(
      clinicGuard({ sectorCaps: [{ sector: 'health', maxKw: 0.5, fromHour: 0, toHour: 24 }] })
    ).toEqual([]);
    expect(clinicGuard({ lifeline: { enabled: true, kw: { health: 0.3, market: 0 } } })).toEqual(
      []
    );
    expect(clinicGuard({ sectorLoads: { health: 0.5, industry: 0 } })).toEqual([]);
  });

  it('flags a zero cap on the clinic', () => {
    expect(
      clinicGuard({ sectorCaps: [{ sector: 'health', maxKw: 0, fromHour: 18, toHour: 22 }] })
    ).toEqual(['cap_zero']);
  });

  it('flags a clinic disconnection, a zero floor and disabled floors', () => {
    expect(clinicGuard({ sectorLoads: { health: 0 } })).toEqual(['disconnected']);
    expect(clinicGuard({ lifeline: { kw: { health: 0 } } })).toEqual(['floor_zero']);
    expect(clinicGuard({ lifeline: { enabled: false } })).toEqual(['lifeline_off']);
  });

  it('lists every reason when several apply', () => {
    expect(
      clinicGuard({
        sectorCaps: [{ sector: 'health', maxKw: 0.01, fromHour: 0, toHour: 6 }],
        sectorLoads: { health: 0 },
        lifeline: { enabled: false, kw: { health: 0 } },
      })
    ).toEqual(['cap_zero', 'disconnected', 'floor_zero', 'lifeline_off']);
  });
});
