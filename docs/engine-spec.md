# Engine spec — `packages/engine`

Simplified energy balance for demo/decision support. **Not** an engineering-grade power-flow simulator.
Types: `docs/contracts.md`.

## 1. Per-step algorithm (t = 0…23, Δt = 1 h)

```text
solarKw   = solar.peakKw × solar.profile[t] × Π(solar_drop factors active at t)
demand_s  = sector.meterReadings?.[t] ?? (sector.profileKw[t] × demandMultiplier × Π(demand_spike factors for s at t))
critical_s= demand_s × sector.criticalShare
demandKw  = Σ demand_s

storedKwh       = soc/100 × capacityKwh
reserveKwh      = minSoc/100 × capacityKwh
dischargeMaxKw  = min(maxDischargeKw, (storedKwh − reserveKwh) × dischargeEff)   // ≥ 0
availableKw     = solarKw + dischargeMaxKw

// Pass 0 Lifeline (PL-T2) + Strategy allocation:
raw_served_s = EXECUTE_STRATEGY(availableKw, demands, criticals, priorities, lifelineEnabled, caps)
served_s     = WATER_FILLING_CAPS(raw_served_s, sectorCaps active at t) // served_s ≤ min(cap_s, demand_s); reallocates freed power
servedKw     = Σ served_s

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

## 2. Strategies, lifeline floors and sector capacity caps

- **Lifeline survival floor (Pass 0, PL-T1/T2)** — baseline power guaranteed to connected sectors before strategy waterfall.
  Default floors (`DEFAULT_LIFELINE_KW`): health 0.3 kW, water 0.2 kW, school 0.1 kW, households 0.4 kW, market 0.1 kW (Σ = 1.1 kW).
  Enabled by default (`strategyParams.lifeline.enabled !== false`).
  - **Normal mode** (`availableKw ≥ Σ planchers`): every sector receives `min(demand_s, lifeline_s)`. Remaining energy is passed to the selected strategy with demand reduced by the floor already served.
  - **Emergency mode** (`availableKw < Σ planchers`):
    (a) water and health alone receive power, at **equal shares**: `min(availableKw / 2, plancher_s, demand_s)` each; if one reaches its floor or demand, surplus goes to the other up to its floor;
    (b) if energy remains once both floors are satisfied, it is shared among other sectors proportional to their planchers; otherwise these sectors receive 0 kW (`mode = 'off'`).
  - **Sector caps priority**: `sectorCaps` (PY) remain priority: if `cap_s < plancher_s`, the cap wins (`effFloor_s = cap_s`).
- **proportional** — `served_s = demand_s × min(1, availableKw / demandKw)`.
- **essential_first** — serve sectors in priority order `critical > high > medium > low`;
  within a tier, share proportionally to demand. A tier is fully served before the next gets anything.
- **balanced** (stretch) — pass 1: serve `critical_s` of all sectors (proportional if short);
  pass 2: share the rest by `demand_s_remaining × weight` with weights (default: `critical 4, high 3, medium 2, low 1`,
  configurable via `strategyParams.balancedWeights` in range 0–10, at least one > 0),
  capped at each sector's remaining demand (iterate water-filling until no remainder or all capped).
  If every sector still in need has weight 0, the leftover is shared by remaining demand (weights ration, never waste).
- **Critical shares (`criticalShare`)** — fraction 0–1 of each sector's demand considered essential (default health 0.8,
  water 0.3, households 0.2, school 0.1, market 0.1; patchable via `InputPatch.criticalShares`).
- **Sector capacity caps (`sectorCaps`)** — optional `sectorCaps?: { sector, maxKw, fromHour, toHour }[]`.
  When caps apply at step $t$, capped sectors receive at most `min(allocation, maxKw)`. Any freed power
  is iteratively reallocated via water-filling to uncapped sectors up to their demand.

## 3. Invariants (checked every step; count into `metrics.violations`)

`0 ≤ served_s ≤ demand_s` · `served_s ≤ cap_s + ε` (when sector cap active) · `servedKw ≤ availableKw + ε` ·
`reserveKwh − ε ≤ storedKwh ≤ capacityKwh + ε` · `|chargeKw| ≤ maxChargeKw`, `|drawKw| ≤ maxDischargeKw` ·
`LIFELINE_MET`: `served_s ≥ min(demand_s, effFloor_s) − ε` when `availableKw ≥ Σ planchers` ·
all values finite · `ε = 1e-9`.
Round **only** at display time (UI `lib/format.ts`), never in the engine.

## 4. Metrics & warnings

Sums over steps (kW × 1 h = kWh). `coveragePct = servedKwh / demandKwh × 100` (100 if demand 0).
`criticalCoveragePct = (criticalDemandKwh − criticalUnservedKwh) / criticalDemandKwh × 100`;
`lifelineCoveragePct = (heldSectorHours / totalSectorHours) × 100` (share of sector-hours where floor is held);
`affectedSectors` = sectors with `unservedKwh > ε`. `criticalUnmetHours` = steps where any `criticalServed_s < critical_s − ε`.
Sector `mode`: `'off'` (< 0.05 kW), `'lifeline'` (≤ floor + ε), `'limited'` (< demand), `'full'` (≥ demand − ε).
Warnings: merge consecutive hours into ranges. `CRITICAL_UNMET` (any critical shortfall),
`SECTOR_PARTIAL` (sector coverage < 100 % in a step), `RESERVE_REACHED` (soc ≤ min + 0.5),
`CURTAILMENT` (curtailedKw > 0), `SECTOR_CAPPED` (sector allocation constrained by a capacity cap),
`ANOMALY_TO_VERIFY` (meter readings persistently diverge from expected profile by > 25% for ≥ 2 consecutive hours),
`LIFELINE_SHORTFALL` (energy < Σ planchers, identifies sectors experiencing shortfall).

## 5. Default parameters

| Item                                 | Value                                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| PV peak                              | 40 kWp; profile = bell 06–18 h, max 0.485 at 12 h (≈ 3.1 peak-sun-hours → ~124 kWh/day; tuned for the demo hero) |
| Battery                              | 120 kWh, init 60 %, min 20 %, max ±25 kW, charge/discharge eff 0.95                                              |
| health (critical, criticalShare 0.8) | 0.6 kW night, 1.2 kW 08–18 → ~20 kWh/day; lifeline floor 0.3 kW                                                  |
| water (high, 0.3, flexible)          | 3 kW 08–16, 0 otherwise → 24 kWh/day; lifeline floor 0.2 kW                                                      |
| school (medium, 0.1)                 | 1.5 kW 07–16 → ~14 kWh/day; lifeline floor 0.1 kW                                                                |
| households (medium, 0.2)             | 1 kW day, 6 kW 18–22, 1.5 kW night → ~50 kWh/day; lifeline floor 0.4 kW                                          |
| market (low, 0.1)                    | 2 kW 08–18 → ~20 kWh/day; lifeline floor 0.1 kW                                                                  |

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
| meter_anomaly      | market meter readings 3.2 kW at 11–15 h (expected 2.0 kW)     |

### Weather workflow (multi-day)

A workflow is 1–7 days, each a full 24 h `simulate()` of the same input under a weather preset that multiplies the
whole solar profile (`WEATHER_SOLAR_FACTOR`): sunny 1 · partly_cloudy 0.75 · cloudy 0.5 · rainy 0.3 · storm 0.15.
Scenario events still apply every day on top. Battery carries over: day N+1 `initialSocPct` = day N `socEndPct`.
One sunny day is identical to `simulate(input)`.

## 7. Tests (Vitest, `packages/engine/src/__tests__`)

nominal no-deficit · solar drop changes results · never below reserve · never above capacity ·
impossible demand reports unserved · invalid input throws ZodError · same input → identical result & id ·
essential_first ≥ proportional on critical-tier (health) coverage (property test over all scenarios; the all-sector
`criticalCoveragePct` can be slightly lower for essential_first, e.g. `essential_stress`, because it serves health's
non-critical load before other sectors' critical shares) ·
energy balance per step: `servedKw = solarKw − batteryKw − curtailedKw` and
`ΔstoredKwh = max(batteryKw,0)·chargeEff − max(−batteryKw,0)/dischargeEff` (both within ε) ·
workflow: SoC chains day to day, darker weather → less solar, totals = sum of days, 7 storm days → 0 violations.
