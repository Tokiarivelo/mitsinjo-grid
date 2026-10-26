# Engine spec — `packages/engine`

Simplified energy balance for demo/decision support. **Not** an engineering-grade power-flow simulator.
Types: `docs/contracts.md`.

## 1. Per-step algorithm (t = 0…23, Δt = 1 h)

```text
solarKw   = solar.peakKw × solar.profile[t] × Π(solar_drop factors active at t)
demand_s  = sector.profileKw[t] × demandMultiplier × Π(demand_spike factors for s at t)
critical_s= demand_s × sector.criticalShare
demandKw  = Σ demand_s

storedKwh       = soc/100 × capacityKwh
reserveKwh      = minSoc/100 × capacityKwh
dischargeMaxKw  = min(maxDischargeKw, (storedKwh − reserveKwh) × dischargeEff)   // ≥ 0
availableKw     = solarKw + dischargeMaxKw

served_s = STRATEGY(availableKw, demands, criticals, priorities)   // Σ served ≤ min(availableKw, demandKw)
servedKw = Σ served_s

if servedKw ≤ solarKw:                         // surplus → charge
   surplus     = solarKw − servedKw
   chargeKw    = min(surplus, maxChargeKw, (capacityKwh − storedKwh) / chargeEff)
   storedKwh  += chargeKw × chargeEff
   curtailedKw = surplus − chargeKw
   batteryKw   = +chargeKw
else:                                          // deficit → discharge
   drawKw      = servedKw − solarKw            // ≤ dischargeMaxKw by construction
   storedKwh  -= drawKw / dischargeEff
   batteryKw   = −drawKw
unservedKw = demandKw − servedKw
```

## 2. Strategies (same battery rules for all → fair comparison)

- **proportional** — `served_s = demand_s × min(1, availableKw / demandKw)`.
- **essential_first** — serve sectors in priority order `critical > high > medium > low`;
  within a tier, share proportionally to demand. A tier is fully served before the next gets anything.
- **balanced** (stretch) — pass 1: serve `critical_s` of all sectors (proportional if short);
  pass 2: share the rest by `demand_s_remaining × weight` with weights `critical 4, high 3, medium 2, low 1`,
  capped at each sector's remaining demand (iterate water-filling until no remainder or all capped).

## 3. Invariants (checked every step; count into `metrics.violations`)

`0 ≤ served_s ≤ demand_s` · `servedKw ≤ availableKw + ε` · `reserveKwh − ε ≤ storedKwh ≤ capacityKwh + ε` ·
`|chargeKw| ≤ maxChargeKw`, `|drawKw| ≤ maxDischargeKw` · all values finite · `ε = 1e-9`.
Round **only** at display time (UI `lib/format.ts`), never in the engine.

## 4. Metrics & warnings

Sums over steps (kW × 1 h = kWh). `coveragePct = servedKwh / demandKwh × 100` (100 if demand 0).
`criticalCoveragePct = (criticalDemandKwh − criticalUnservedKwh) / criticalDemandKwh × 100`;
`affectedSectors` = sectors with `unservedKwh > ε`. `criticalUnmetHours` = steps where any `criticalServed_s < critical_s − ε`.
Warnings: merge consecutive hours into ranges. `CRITICAL_UNMET` (any critical shortfall),
`SECTOR_PARTIAL` (sector coverage < 100 % in a step), `RESERVE_REACHED` (soc ≤ min + 0.5),
`CURTAILMENT` (curtailedKw > 0).

## 5. Default parameters

| Item                                 | Value                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| PV peak                              | 40 kWp; profile = bell 06–18 h, peak 12–13 h (≈ 5 peak-sun-hours → ~200 kWh/day) |
| Battery                              | 120 kWh, init 60 %, min 20 %, max ±25 kW, charge/discharge eff 0.95              |
| health (critical, criticalShare 0.8) | 0.6 kW night, 1.2 kW 08–18 → ~20 kWh/day                                         |
| water (high, 0.3, flexible)          | 3 kW 08–16, 0 otherwise → 24 kWh/day                                             |
| school (medium, 0.1)                 | 1.5 kW 07–16 → ~14 kWh/day                                                       |
| households (medium, 0.2)             | 1 kW day, 6 kW 18–22, 1.5 kW night → ~50 kWh/day                                 |
| market (low, 0.1)                    | 2 kW 08–18 → ~20 kWh/day                                                         |

Total ≈ 128 kWh/day. Tune so that: `baseline` → 0 unserved; `cloudy_afternoon`
(solar ×0.6 for 2 h at 13–15 h, plus low initial SoC 35 %) → visible evening deficit where
`proportional` leaves `criticalUnservedKwh > 0` and `essential_first` = 0. **Write that as a test.**

## 6. Scenarios

| id                 | Change vs baseline                                            |
| ------------------ | ------------------------------------------------------------- |
| baseline           | none                                                          |
| cloudy_afternoon   | solar_drop factor 0.6, 13 h, 2 h; initialSoc 35 % (demo hero) |
| high_demand        | demand_spike all ×1.3, 17 h, 5 h                              |
| battery_constraint | capacity 60 kWh, initialSoc 30 %                              |
| essential_stress   | solar ×0.4 for 4 h at 11 h + initialSoc 25 %                  |

## 7. Tests (Vitest, `packages/engine/src/__tests__`)

nominal no-deficit · solar drop changes results · never below reserve · never above capacity ·
impossible demand reports unserved · invalid input throws ZodError · same input → identical result & id ·
essential_first ≥ proportional on critical coverage (property test over all scenarios) ·
energy balance per step: `servedKw = solarKw − batteryKw − curtailedKw` and
`ΔstoredKwh = max(batteryKw,0)·chargeEff − max(−batteryKw,0)/dischargeEff` (both within ε).
