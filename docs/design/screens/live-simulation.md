# Live Simulation

Route: /simulation. Goal: explore the microgrid and see how parameter changes affect distribution.
Reference visuals: `design/reference/tableau-de-bord-solaire-futuriste.png` (master UI mockup) and `design/reference/village-3d-2d-schema.jpg` (canonical village topology).
Scene spec: ../3d-scene.md. Shell: ../shell.md.

## Layout (see `design/reference/tableau-de-bord-solaire-futuriste.png`)

```
+-----------------------------------------------------------------------------------------+
| Live Simulation / subtitle  [Baseline Village v]  [SIMULATION COMPLETE]  [Reset] [AI] [JD]|
+-------------------+-------------------+--------------------+----------------------------+
| Solar Generation  | Battery State     | Community Demand   | Essential Services         |
| 18.4 kW (spark)   | 78% (progress)    | 22.7 kW (progress) | 96% (4/5 services)         |
+-------------------+-------------------+--------------------+----------------------------+
| 3D Village Viewport (>=60% width)               | BuildingPanel    | Mitsinjo Copilot           |
|  - Solar, Battery, Pump, School, Clinic, Houses | (Selected clinic | (AI EXPLANATION,           |
|  - Glowing cyan grid lines & live badges        |  demand/alloc)   |  evidence, suggestions)    |
|  - [3D][2D][pin]   View: Village v              |                  |                            |
+-------------------+-----------------------------+------------------+----------------------------+
| Energy Balance    | Generation vs Demand (24h)  | Service Allocation                            |
| 42.7 kWh (donut)  | Solar vs Demand vs Battery  | Clinic, Water, School, Houses, Market         |
+-------------------+-----------------------------+-----------------------------------------------+
| Essential services fully supplied (banner)                                        [View details]|
+-------------------------------------------------------------------------------------------------+
```

## Sections -> components

- Scene: 3D scene + preset buttons (Button ghost).
- Controls: SimControl for solar multiplier (%), battery capacity (kWh), initial SoC (%), demand adjustment (%), solar-drop start + duration (h; horizon fixed 24 h); ScenarioSelector; strategy select (proportional | essential_first | balanced); Button primary "Run simulation", secondary "Reset scenario".
- Impact banner: StatusBadge + text, conditional.
- Energy balance: ChartCard (kW over 24 steps).
- Detail: BuildingPanel on selection; else EnergyBar list for 5 sectors.
- Timeline scrubber/Pause/Step: render only if engine supports (hide otherwise).

## Data bindings

- Banner: metrics.criticalUnservedKwh > 0 -> "Clinic supply below target" / "Water pumping demand partially unmet" (via perSector.health/water.unservedKwh); warning RESERVE_REACHED -> "Battery reserve depleted before simulation end"; criticalUnservedKwh == 0 && unservedKwh == 0 -> "Essential services fully supplied".
- Chart: steps[t].solarKw, demandKw, servedKw, unservedKw, socPct (kW left axis, % right axis).
- Scene/BuildingPanel: perSector[id].{demandKwh, servedKwh, unservedKwh, coveragePct}; steps[t] for time slice.
- Summary strip: metrics.servedKwh / demandKwh, socEndPct.

## States

- ready: no result; scene neutral, EmptyState "Your microgrid is ready to simulate." + Run first simulation.
- modified: last result dimmed + `Scenario modified`.
- running: "Calculating energy distribution..." only if truly async.
- complete: `Simulation complete`; banner and values update.
- error: inline error, controls stay editable. Invalid field: message at SimControl.
- WebGL unavailable: 2D fallback (3d-scene.md). Copy: ../states-copy.md.

## Acceptance

- [ ] 3D scene is the dominant element, not a thumbnail.
- [ ] Every slider shows value, unit, min/max.
- [ ] Changing any control sets `modified` until Run.
- [ ] Impact banner appears only when its condition holds in result.
- [ ] Clicking a building opens BuildingPanel with engine values.
- [ ] Works with WebGL off (2D summary) and reduced motion.
- [ ] No Pause/Step/Scrubber unless supported.
- [ ] `SIMULATED DATA` label visible.
