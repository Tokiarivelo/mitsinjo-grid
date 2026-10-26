# Scenarios and Assumptions

Route: /scenarios. Goal: make assumptions understandable, repeatable, comparable. Reuse form controls from live-simulation.md.

## Predefined scenarios (synthetic, not historical)

- Baseline Village: normal production and demand.
- Cloudy Afternoon: reduced solar over a defined period.
- High Community Demand: higher household and community demand.
- Battery Constraint: lower capacity or initial SoC.
- Essential Services Under Stress: tests prioritization in shortage.

## Layout

```
+--------------------------------------------------------------+
| Scenarios   DATA SOURCE: SYNTHETIC SIMULATION  (note)         |
+------------------------------+-------------------------------+
| Scenario cards grid (2-3 col)| Assumptions panel (selected)  |
| name, desc, type, deltas,    |  solar profile, battery, SoC, |
| last run status, [Open]      |  demand per sector, duration/ |
|                              |  step (24 x 1 h), rules, losses|
|                              |  [Reset to defaults]          |
+------------------------------+-------------------------------+
| Latest-run parameter summary (compact, reproducibility)       |
+--------------------------------------------------------------+
```

## Sections -> components

- Scenario card: name, one-sentence description, type StatusBadge, key param changes (mono), last-run StatusBadge (ready|complete|modified|error), Button secondary "Open scenario" (sets active, goes to /simulation).
- Assumptions panel: SimControl rows; read-only rows where engine does not support editing.
- Provenance: StatusBadge simulated + note: data is illustrative, not measured from a real village.
- Edit via modal/drawer on small screens.

## Data bindings

- Cards: scenario config + last run status per scenario.
- Assumptions: scenario schema fields (Zod); demand per sector ids health, water, school, households, market with priority (critical|high|medium|low).
- Last-run summary: params used + metrics.servedKwh, unservedKwh, socEndPct.

## States

- No saved runs: card shows "Not run yet". Invalid field: named error, no silent clamp. Edited: `Scenario modified`. Reset restores defaults with confirm. Copy: ../states-copy.md.

## Acceptance

- [ ] 5 predefined scenarios listed with descriptions.
- [ ] `DATA SOURCE: SYNTHETIC SIMULATION` visible with note.
- [ ] Only engine-supported assumptions are editable.
- [ ] Reset to defaults available and confirmed.
- [ ] Latest-run parameter summary shown.
- [ ] Invalid input explains the fix.
- [ ] Cards reflow to 1 column on mobile.
