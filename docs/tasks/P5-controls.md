# P5 — Controls, scenarios, timeline, export (Day 5)

**Read first:** `docs/design/screens/live-simulation.md` · `docs/design/screens/scenarios.md` · `docs/contracts.md` (InputPatch, bounds)
**Goal:** judges can change the scenario live without reloading.

- [x] **P5-T0** Design gate in for every screen of this phase: Run `/design-check` gate-in (spec + Stitch mockup from `docs/design/stitch-map.md`) before coding.
- [x] **P5-T1** SimControls (sliders with value, unit, min/max): solar drop %, drop start/duration, demand multiplier, battery capacity, initial SoC, strategy select. Invalid → inline message (Zod), never silent clamp.
- [x] **P5-T2** Status flow: `ready → modified → complete`; `Run` and `Reset scenario` buttons; ScenarioSelector in Header.
- [x] **P5-T3** Scenarios screen: 5 scenario cards, assumptions panel (read-only from input), provenance `DATA SOURCE: SYNTHETIC SIMULATION`, last-run parameter summary.
- [x] **P5-T4** Export summary: "Copy summary" (markdown) + "Download JSON" (input + metrics + resultIds). Dossier MVP feature #8.
- [x] **P5-T5** (stretch) Timeline scrubber + play/pause over 24 steps (`timeIndex` in store); charts show cursor.
- [x] **P5-T6** Tests: control validation, modified status, export content contains resultId.
- [x] **P5-T7** (stretch) Weather workflow: multi-day sequence (Day 1 sunny → Day 2 cloudy…) with weather pills, SoC carried day to day, day strip + playback roll-over; engine, store and UI tests.
- [x] **P5-T8** Weather in 3D: overcast sky, clouds, rain, storm lightning per day; HUD weather badge; weather edits re-run the engine so solar output updates at once.

**Exit criteria:** `/design-check` gate-out passed: screenshot matches mockup (or deviations logged); row status `checked`. Plus: full demo scenario configurable from UI in < 30 s.
