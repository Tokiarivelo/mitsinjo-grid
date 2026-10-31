# Overview (Incident screen)

Route: `/overview` (landing, `/` redirects here). Goal in 5 seconds: what is at stake today (are essential
services at risk), its computed impact, and the one decision that changes it. Not a dashboard: no KPI card
row, no 24h chart, no sector list (those live on `/simulation` and `/strategies`).
Reference design: `design/stitch/overview.png` is the old dashboard; this screen is built without a mockup (see stitch-map Notes).
Scene spec: `docs/design/3d-scene.md`. Shell: `docs/design/shell.md`. Contracts: `docs/contracts.md`.

## Layout

```
[SIMULATED DATA] [Scenario ▾]
+------------------------------------------------+-------------------------------+
| ● INCIDENT · ESSENTIAL SERVICES (pulsing pill) | Village twin preview          |
| H1: The clinic and the water pump go dark at   | (GridSchematicPreview, 3D/2D, |
|     23:00.                                     |  quick phases, docked strip)  |
| Strategy + missing kWh sentence                |                               |
| [23:00 Outage starts][1 h Hours][0.1 kWh]      |                               |
| [Ask the copilot why]  [See the village at 23:00]                               |
+------------------------------------------------+-------------------------------+
| Same day, different decision            [Compare strategies →]                 |
|  ( ring 99.6% )        ( ring 100% )          ( ring 100% )                    |
|  Proportional          Essential-First        Balanced                        |
|  1 h without power     0 h without power      0 h without power               |
|  [Active]              [Top protection]                                       |
+--------------------------------------------------------------------------------+
```

Mobile: hero text then twin (one column); the 3 rings stay side by side (small ring, caption hidden).

## States (`IncidentHero`)

- **empty** (no result): amber pill, "What happens when the sun drops?", buttons « Simulate a solar drop (−40%) »
  (loads `cloudy_afternoon`, runs, moves the twin to the outage hour) and « Run simulation ».
- **risk** (`metrics.criticalUnservedKwh > 0.05` for the active strategy): red pill + glow, title with the first
  `CRITICAL_UNMET` warning `fromHour`, 3 impact tiles (start hour, `criticalUnmetHours`, `criticalUnservedKwh`),
  primary CTA → `/copilot`, secondary « See the village at HH:00 » sets `timeIndex`.
- **safe**: green pill + glow, tiles = essential coverage % and unmet hours, primary « Simulate a solar drop », secondary → `/copilot`.

## Strategy rings (`StrategyRings` + `CoverageRing`)

- One ring per strategy in `results`: `metrics.criticalCoveragePct`; green at ≥ 99.95, else red; below, `criticalUnmetHours`.
- Badges: active strategy; best = highest essential coverage (first on a tie). Shown only when ≥ 2 strategies ran.

## Data bindings

- All values from the engine result via `summarizeIncident(results, activeStrategy)` (`features/overview/utils/incident.ts`,
  selection only). Formatting via `@/lib/format`.
- Changing the scenario in the page selector loads it and runs the engine right away.

## Acceptance criteria

- [x] Risk / safe / empty states with distinct color + text + icon; works dark and light; no horizontal scroll at 390 px.
- [x] Every number matches `/strategies` for the same strategy.
- [x] CTAs ≥ 44 px; rings have an accessible name (`role="img"`).
- [x] 100% i18n parity (`overview.incident.*`).
