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
  Default floors (`DEFAULT_LIFELINE_KW`): health 0.3 kW, water 0.2 kW, school 0.1 kW, households 0.4 kW, market 0.1 kW, industry 0 kW (Σ = 1.1 kW).
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
`lifelineCoveragePct = (heldSectorHours / totalSectorHours) × 100` (share of sector-hours where `served_s ≥ min(demand_s, floor_s)`, with `floor_s` lowered to an active cap — same rule as `LIFELINE_MET` and `LIFELINE_SHORTFALL`);
`affectedSectors` = sectors with `unservedKwh > ε`. `criticalUnmetHours` = steps where any `criticalServed_s < critical_s − ε`.
Sector `mode`, checked in this order: `'full'` (demand > ε and served ≥ demand − ε), `'off'` (served < 0.05 kW: no power or no load), `'lifeline'` (≤ floor + ε), `'limited'` (otherwise). With `lifeline.enabled = false` the floor is 0, so `'lifeline'` never appears.
Warnings: merge consecutive hours into ranges. `CRITICAL_UNMET` (any critical shortfall),
`SECTOR_PARTIAL` (sector coverage < 100 % in a step), `RESERVE_REACHED` (soc ≤ min + 0.5),
`CURTAILMENT` (curtailedKw > 0), `SECTOR_CAPPED` (sector allocation constrained by a capacity cap),
`ANOMALY_TO_VERIFY` (meter readings persistently diverge from expected profile by > 25% for ≥ 2 consecutive hours),
`LIFELINE_SHORTFALL` (energy < Σ planchers, identifies sectors experiencing shortfall),
`FIRE_ISOLATION` (every hour a `fire` event cuts a sector).
Fire (`{ type: 'fire', sector, startHour, durationH }`, F1, ENGINE_VERSION 0.4.0): each fire adds a 0 kW cap on its sector for
its hours (`effectiveSectorCaps`). Caps combine by minimum, so the fire beats strategy, operator caps and the lifeline floor
(the cap-aware floor drops to 0, no `LIFELINE_SHORTFALL`); the energy goes to the other sectors; mode `off`.
Change impact (`changeImpact(before, after)`): per sector `servedKwh` before/after/delta and `offHours` (steps with
demand > ε and `mode = 'off'`; a sector without load is never off), plus `socMinPct` and `unservedKwh` before/after.
Used by the approval dialog ("Engine calculation").
Clinic guard (`clinicGuard(patch)`, K6): lists why a patch endangers `health` — `cap_zero` (cap < 0.05 kW),
`disconnected` (`sectorLoads.health = 0`), `floor_zero` (lifeline floor < 0.05 kW), `lifeline_off` (floors disabled).
Empty = safe. The dialog then shows a red warning and needs a second click.

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
| industry (low, 0, flexible)          | small factory ≈ 8 kW in working hours; **not connected by default** (`loadMultiplier: 0`), no lifeline floor     |

Total ≈ 128 kWh/day (factory not connected). Tune so that: `baseline` → 0 unserved; `cloudy_afternoon`
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

### Live sector load (`loadMultiplier`)

Demand of a sector at hour t = `(profileKw[t] × (loadMultiplier ?? 1) + applianceKw[t]) × demandMultiplier × active spikes`
(meter readings replace the whole modelled profile, appliances included). `applianceKw` = sum of
`applianceProfileKw` of the sector's appliances (PV, ENGINE_VERSION 0.5.0); 0 when the sector is not connected. `0` = not connected: zero demand, hidden from overview, strategy cards and
coverage lists (`connectedSectors`). Set via `InputPatch.sectorLoads` (UI slider on `/simulation`, copilot patch).

### Adding a consumer sector (checklist)

1. `schemas/common.ts` → append the id to `SECTOR_IDS` (Zod enum and lengths follow).
2. `constants.ts` → `DEFAULT_LIFELINE_KW[id]`; `scenarios/baseline.ts` → profile + `SectorConfig`
   (`loadMultiplier: 0` keeps existing scenario numbers unchanged). Bump `ENGINE_VERSION`.
3. `pnpm typecheck`: every exhaustive `Record<SectorId, …>` in web (3D position, keep-out radius, icon, diagram
   box/wire, body layout) fails until filled. Add the 3D body in `ui/building-bodies.tsx`.
4. i18n `sectors.<id>` in en/fr/mg (`make check-i18n`).

### Weather workflow (multi-day)

A workflow is 1–7 days, each a full 24 h `simulate()` of the same input under a weather preset that multiplies the
whole solar profile (`WEATHER_SOLAR_FACTOR`): sunny 1 · partly_cloudy 0.75 · cloudy 0.5 · rainy 0.3 · storm 0.15.
Scenario events still apply every day on top. Battery carries over: day N+1 `initialSocPct` = day N `socEndPct`.
One sunny day is identical to `simulate(input)`.

### Physical scale model (PH)

`hardware/` converts what the scale model measures into an `InputPatch` (`scaleTelemetry`) and turns a result
into feeder setpoints (`toHardwareCommand`); `dispatch/` holds the breaker / controller / flow mapping shared with
the 3D and 2D views. No new energy math: demand comes from `computeProfileDemandKw` × request, served kW from the
result. Contract and formulas: `contracts.md` § Physical scale model; hardware design: `docs/maquette-physique.md`.

### Appliance catalog (PV)

`appliances/catalog.ts` → `APPLIANCE_CATALOG[category]`: rated power bounds (W) and a default 24 h duty profile
(share of each hour at rated power). Inserted appliances (`input.appliances`) add to their sector's demand, see
§ Live sector load; `watts` must stay within the category bounds. Orders of magnitude for village use, cross-checked
against Efficiency for Access / CLASP appliance data, the ESMAP Multi-Tier Framework load tiers and WHO PQS E003
(solar vaccine fridges). Vision only picks the category; watts and hours come from here.

| category          | default W (min–max) | default use                         |
| ----------------- | ------------------- | ----------------------------------- |
| fridge / freezer  | 100 / 150 (50–400)  | 24 h, duty 0.35–0.4, 0.5–0.55 12–18 |
| fridge_vaccine    | 60 (30–150)         | 24 h, duty 0.35, 0.45 12–18         |
| tv                | 60 (20–200)         | 12–14 0.3, 18–22 1, 22–23 0.4       |
| lamp              | 10 (3–60)           | 05–06 0.5, 18–22 1, 22–24 0.3       |
| fan               | 50 (20–100)         | 11–16 0.8, 19–22 0.5                |
| laptop / computer | 50 / 150 (20–300)   | 08–17 0.6 / 0.8 (+ laptop 19–21)    |
| phone_charger     | 5 (2–20)            | 12–14 0.3, 18–22 0.5                |
| radio             | 10 (3–40)           | 06–08, 12–13 0.5, 18–21 0.7         |
| water_pump        | 750 (200–3000)      | 08–16, full 09–15 (sun-driven)      |
| rice_mill         | 7500 (3000–15000)   | 08–12 and 14–17, duty 0.6           |
| sewing_machine    | 100 (50–250)        | 08–12 and 14–17, duty 0.5           |
| welder            | 3000 (1500–6000)    | 09–12 and 14–16, duty 0.3           |
| other             | 100 (1–5000)        | 08–18, duty 0.5                     |

## 7. Tests (Vitest, `packages/engine/src/__tests__`)

nominal no-deficit · solar drop changes results · never below reserve · never above capacity ·
impossible demand reports unserved · invalid input throws ZodError · same input → identical result & id ·
essential_first ≥ proportional on critical-tier (health) coverage (property test over all scenarios; the all-sector
`criticalCoveragePct` can be slightly lower for essential_first, e.g. `essential_stress`, because it serves health's
non-critical load before other sectors' critical shares) ·
energy balance per step: `servedKw = solarKw − batteryKw − curtailedKw` and
`ΔstoredKwh = max(batteryKw,0)·chargeEff − max(−batteryKw,0)/dischargeEff` (both within ε) ·
workflow: SoC chains day to day, darker weather → less solar, totals = sum of days, 7 storm days → 0 violations.
