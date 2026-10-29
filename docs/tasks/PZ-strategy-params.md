# PZ — Parametrable Strategy Lab (3 phases)

**Read first:** `docs/design/screens/strategy-lab.md` · `docs/design/components.md` · `docs/contracts.md` (InputPatch)
· `docs/engine-spec.md` §2 (phase 2 and 3 only)
**Goal:** the user tunes the conditions and the strategy rules on `/strategies` and sees, through the engine only,
where the three strategies diverge. Design: design system only (tokens + components), no Stitch mockup (owner decision 2026-10-28).

## Phase 1 — Comparison parameters panel (web only, no engine change)

- [x] **PZ-T1** `StrategyParamsPanel` (collapsible) above the strategy cards: solar drop % / start / duration,
      demand multiplier, battery capacity, initial SoC (existing `SimControl` + `validatePatch`, never clamps).
      **Done when:** each slider patches the store input through `applyPatch`; invalid values show an inline error.
- [x] **PZ-T2** Per-sector editor: priority select (critical / high / medium / low) and optional power cap
      (`maxKw`, `fromHour`–`toHour`) → `InputPatch.priorities` / `sectorCaps`. **Done when:** changing the
      household priority changes Essential-First results and leaves Proportional unchanged (test).
- [x] **PZ-T3** Auto-compare: an input edit re-runs the 3 strategies after 300 ms (`useAutoCompare`), reset button
      restores the scenario preset. **Done when:** hook test with fake timers; no run while status ≠ `modified`.
- [x] **PZ-T4** Best-value badges only when one strategy is strictly best (ties → no badge), `summarizeComparison`
      returns `null` per tied metric; card props built by one helper (`bestMetricsFor`). **Done when:** baseline shows no badge.
- [x] **PZ-T5** Shared `usePatchValidation` hook replaces the copies in SimControlsPanel and AssumptionsInspector.
- [x] **PZ-T6** i18n EN/FR/MG, mobile (1 column, 44 px targets), dark + light. `make check` green.

## Phase 2 — Strategy rule parameters (engine change, `/engine-change`)

- [x] **PZ-T7** Contract: `SimulationInput.strategyParams?: { balancedWeights?: Record<Priority, number> }`
      (weights 0–10, at least one > 0); default = 4/3/2/1 → identical result and input hash when absent.
- [x] **PZ-T8** `InputPatch.criticalShares?: Partial<Record<SectorId, number>>` (0–1) and `balancedWeights?`;
      `applyPatch` + tests. Update `docs/contracts.md`, `docs/engine-spec.md` §2.
- [x] **PZ-T9** Strategy subset: `run(strategies)` from the UI (checkbox per strategy, min 2); chart and summary
      handle a missing strategy.
- [x] **PZ-T10** UI: "Strategy rules" section in the panel (weights sliders, critical share per sector);
      copilot `propose_change` accepts the new fields (`/copilot-tool`), eval case added.

## Phase 3 — Sensitivity sweep (engine + chart)

- [x] **PZ-T11** Engine `sweep(input, { param: 'solarDropPct' | 'demandMultiplier' | 'initialSocPct', from, to, step }, strategies)`
      → `{ value, metrics per strategy }[]`, pure, ≤ 20 points, tested (monotonic critical unserved on solar drop).
- [x] **PZ-T12** `SensitivityChart` (ChartCard + Recharts lines, one per strategy, y = critical unserved kWh,
      text summary, empty state); parameter picker; marker at the current value.
- [x] **PZ-T13** Divergence callout (computed InsightCard): first value where strategies differ by > 0.1 kWh.
- [x] **PZ-T14** Perf: sweep in a `useDeferredValue`/idle callback, budget in `docs/performance.md` (< 50 ms for 20 points).

**Exit criteria:** every number still comes from `@mitsinjo/engine`; edits never auto-apply anything outside the
simulated input; phase 1 shippable alone; `make check` + `make e2e` green after each phase.
