# Overview

Route: /overview. Goal in 5 seconds: how much energy is available, are essential services supplied, what if the scenario changes. Reuse cards/charts from live-simulation.md.

## Layout

```
+--------------------------------------------------------------+
| Microgrid Overview  / subtitle      [scenario] [Run|Open live]|
+------------+------------+------------+-----------------------+
| Solar      | Battery    | Demand     | Essential services    |
+------------+------------+------------+-----------------------+
| 3D preview (large)                  | Energy balance summary |
+-------------------------------------+------------------------+
| Gen vs demand ChartCard | Service allocation | Scenario impact |
+-------------------------------------+------------------------+
```

## Sections -> components

- Hero: title "Microgrid Overview", subtitle "Understand energy availability and community impact.", ScenarioSelector label, Button primary ("Run simulation" if no result, else "Open live simulation" -> /simulation).
- 4 MetricCard: solar, battery, demand, essential.
- 3D preview (../3d-scene.md, orbit optional) + energy balance summary list.
- ChartCard "Energy over time".
- Service allocation: 5 EnergyBar rows (health, water, school, households, market).
- Scenario impact: InsightCard(s), computed only.

## Data bindings

- Solar: max/avg of steps[t].solarKw (kW); label which. Delta vs baseline only if a baseline result exists.
- Battery: socEndPct (%) and socMinPct; stored kWh only if capacity known from scenario.
- Demand: metrics.demandKwh (kWh, 24 h) and servedKwh; show unservedKwh. Do not label as kW.
- Essential: metrics.criticalCoveragePct; affected count = metrics.affectedSectors.length; warning if metrics.criticalUnservedKwh > 0.
- Balance: sum solar kWh = sum steps.solarKw; battery net = sum steps.batteryKw; served, unserved. Use engine accounting definition; state it in tooltip.
- Rows: perSector[id].coveragePct.

## States

- No result: EmptyState "No simulation results yet" + Run first simulation (cards show "--").
- modified: stale badge on cards. running/error: see ../states-copy.md.

## Acceptance

- [ ] Four metric cards each have value + unit + caption.
- [ ] kW and kWh visually and textually distinct.
- [ ] Essential-services card shows warning label (not only color) when criticalUnservedKwh > 0.
- [ ] All five sectors listed with % and status label.
- [ ] Every chart has units and empty state.
- [ ] No-result state shown before first run.
- [ ] 3D preview has 2D fallback.
