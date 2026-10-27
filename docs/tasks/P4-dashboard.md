# P4 — 2D dashboard + Strategy Lab (Day 4)

**Read first:** `docs/architecture.md` §3–5 · `docs/design/screens/overview.md` · `docs/design/screens/strategy-lab.md`
**Goal:** the product's value is visible without 3D or AI.

- [x] **P4-T0** Design gate in for every screen of this phase: Run `/design-check` gate-in (spec + Stitch mockup from `docs/design/stitch-map.md`) before coding.
- [x] **P4-T1** `stores/simulation.store.ts` + `selectors.ts` (shape: architecture §5); runs `compare(input, ['proportional','essential_first'])`. Tests.
- [x] **P4-T2** `lib/format.ts` (`fmtKw`, `fmtKwh`, `fmtPct`) + tests.
- [x] **P4-T3** Overview: 4 MetricCards (solar, battery, demand, essential services), service allocation rows (EnergyBar ×5), empty state before first run.
- [x] **P4-T4** Charts (`components/charts`): EnergyOverTime (solar, demand, served, SoC on 2nd axis), ServiceCoverage, StrategyComparison. Labeled axes + units.
- [x] **P4-T5** Strategy Lab: side-by-side strategy cards, grouped bars, decision summary generated **from metrics by rule** (`utils/summarize.ts`, no LLM), "Use this strategy" action.
- [x] **P4-T6** Impact banners driven only by `result.warnings`.
- [x] **P4-T7** Hook/component tests (store-driven render, summary rule cases).

**Exit criteria:** `/design-check` gate-out passed: screenshot matches mockup (or deviations logged); row status `checked`. Plus: cloudy_afternoon → run → both strategies compared with numbers + charts; SIMULATED label on every screen.
