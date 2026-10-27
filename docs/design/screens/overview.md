# Overview

Route: `/overview`. Goal in 5 seconds: how much energy is available, are essential services supplied, and what is the community impact under the active scenario.
Reference design: `design/stitch/overview.html` (exported to `design/stitch/overview.png`).
Scene spec: `docs/design/3d-scene.md`. Shell: `docs/design/shell.md`. Contracts: `docs/contracts.md`.

## Layout (2-Column Bento Command Center)

The page uses a clean, compact Bento grid that fits standard desktop viewports (1440×900) with minimal scrolling, delivering an executive operational cockpit.

```
+-----------------------------------------------------------------------------------------------+
| Mitsinjo Grid | Overview   [Scenario: Baseline v] [SIMULATED DATA]       [Run / Open Live ->] |
+---------------------+---------------------+---------------------+-----------------------------+
| Solar Peak (kW)     | Battery SoC (%)     | Total Demand (kWh)  | Essential Coverage (%)      |
+---------------------+---------------------+---------------------+-----------------------------+
| LEFT COLUMN (col-span-7, ~60%)            | RIGHT COLUMN (col-span-5, ~40%)                   |
| +---------------------------------------+ | +-----------------------------------------------+ |
| | Village Digital Twin Preview          | | | Service Allocation & Load Shedding Hierarchy   | |
| | [3D/2D toggle] [Camera Reset] [HUD]   | | | - Health Clinic (100% Critical - Tier 1)      | |
| | (Interactive 3D village canvas)       | | | - Water Pumping Station (Tier 1)              | |
| |                                       | | | - Primary School (Tier 2)                     | |
| | Quick Phases: [06h] [12h] [19h] [23h] | | | - Village Households (Tier 2)                 | |
| +---------------------------------------+ | | - Communal Market (Tier 3)                    | |
| | Docked Balance: Solar | Bat | Served  | | | [Automated Shedding Policy Notice]            | |
| +---------------------------------------+ | +-----------------------------------------------+ |
| | 24h Generation vs Demand Telemetry    | | | Scenario Impact & Operational Insights        | |
| | (Recharts curves with live hour line) | | | - ImpactBanner (Warnings & Anomaly flags)     | |
| +---------------------------------------+ | | - InsightCard (Computed clinic evidence)      | |
|                                           | | - [Compare in Strategy Lab ->]                | |
|                                           | +-----------------------------------------------+ |
+-------------------------------------------+---------------------------------------------------+
```

## Sections & Components

### 1. Top Executive Bar
- App Title: `Mitsinjo Grid` + subtitle "Understand energy availability and community impact."
- Simulated Data Badge: `SIMULATED DATA` status pill.
- Scenario Selector: Interactive dropdown allowing the operator to switch active scenario (`baseline`, `cloudy_afternoon`, `high_demand`, `battery_constraint`, `essential_stress`, `meter_anomaly`) directly from the overview.
- Primary Action Button:
  - If no simulation results yet: `Run simulation` (loading state when simulating).
  - If simulation is complete: `Open live simulation` (links to `/simulation`).

### 2. Four Telemetry Metric Cards
Four cards spanning 4 columns (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`):
- **Peak Solar PV**: Value in `kW` (`Math.max(...steps.map(s => s.solarKw))`), caption with total 24h generated `kWh` (`metrics.solarKwh`), amber icon and accent.
- **Battery End SoC**: Value in `%` (`metrics.socEndPct`), caption with minimum SoC and total battery capacity `kWh`, warning state if ending SoC approaches minimum reserve.
- **Total 24h Demand**: Value in `kWh` (`metrics.demandKwh`), caption with unserved energy `kWh` (`metrics.unservedKwh`), warning if unserved energy > 0.1 kWh.
- **Essential Services**: Value in `%` (`metrics.criticalCoveragePct`), critical red status when `metrics.criticalUnservedKwh > 0.05`, caption detailing shortfall `kWh` and unmet hours.

### 3. Left Column (col-span-7 Bento): Digital Twin & 24h Telemetry
- **Village Digital Twin Preview (`GridSchematicPreview`)**:
  - Interactive 3D microgrid digital twin (`LazyVillageCanvas`) with 2D schematic fallback for devices without WebGL.
  - HUD Reticle Badges: `NODE: MITSINJO_CENTRAL_BUS`, camera reset, 3D/2D view toggle.
  - Quick-Phase Hour Selector: interactive pill buttons (`06:00 Dawn`, `12:00 Solar Peak`, `19:00 Evening`, `23:00 Night`) to inspect flow dynamics at critical operational hours.
  - **Docked Energy Balance Summary Strip**:
    - Four compact telemetry nodes docked at the bottom of the twin container:
      1. `Total Solar Generated`: `metrics.solarKwh` (Amber).
      2. `Stored in Battery`: `metrics.socStartPct → metrics.socEndPct` (Battery Green).
      3. `Total Served Energy`: `metrics.servedKwh` (Cyan).
      4. `Total Unserved Deficit`: `metrics.unservedKwh` (Critical Red if > 0, else muted).
- **Generation vs Demand Telemetry (`ChartCard`)**:
  - 24-hour Recharts composite chart (`EnergyOverTimeChart`).
  - Curves: Solar Generation (amber fill + curve), Total Demand (cyan dashed line), Battery Flux & SoC.
  - Unit: `kW / %`. Resolution: 1-hour engine step horizon.

### 4. Right Column (col-span-5 Bento): Sectors & Resilience Impact
- **Service Allocation & Load Shedding Hierarchy**:
  - 5 Village Sectors ordered by resilience tier:
    1. Health Clinic (Critical Tier 1)
    2. Water Pumping Station (Critical Tier 1)
    3. Primary School (Tier 2)
    4. Village Households (Tier 2)
    5. Local Market & Artisans (Tier 3)
  - Each row uses `EnergyBar` showing served vs demand `kWh` and coverage `%`.
  - Automated shedding protocol informational note: explains tier prioritization when storage is low.
- **Scenario Impact & Operational Insights**:
  - `ImpactBanner`: Active engine warnings (e.g., `CRITICAL_SERVICE_DEFICIT`, `BATTERY_DEPLETED`, `ANOMALY_TO_VERIFY`).
  - `InsightCard`: Computed algorithmic insights (e.g., clinic warning on proportional shedding with evidence reference `metrics.criticalUnservedKwh > 0`).
  - Strategy CTA: Action link directing operator to `/strategies` to compare resilience algorithms.

---

## Data Bindings & Contracts

- Strictly adhere to `docs/contracts.md` and `@mitsinjo/engine`.
- All numbers originate from simulation result metrics and hourly steps.
- Distinguish power (`kW`) and energy (`kWh`) clearly in units and labels.
- No synthetic telemetry hallucination (no fake temperature, humidity, or irradiance).

## Acceptance Criteria

- [ ] 2-Column Bento layout (`col-span-7` Left / `col-span-5` Right) balances height on 1440×900 screens without excessive scrolling.
- [ ] Four metric cards display value + unit + caption, with distinct `kW` and `kWh`.
- [ ] Digital twin preview features quick-phase hour buttons to scrub between daylight and night hours.
- [ ] Docked Energy Balance strip displays 4 canonical metrics below the 3D twin canvas.
- [ ] All 5 village sectors listed with priority tag, coverage %, and progress bar.
- [ ] Scenario selector in hero bar updates active scenario across store.
- [ ] 3D canvas includes graceful 2D schematic fallback for environments without WebGL.
- [ ] 100% i18n translation key parity across English, French, and Malagasy.
