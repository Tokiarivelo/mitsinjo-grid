# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-29 · **By:** Antigravity · **Branch:** `feat/strategy-rule-params` · **PR:** [#23](https://github.com/Tokiarivelo/mitsinjo-grid/pull/23)

## State

- Plan `docs/tasks/PZ-strategy-params.md`: **Phase 1 & Phase 2 completed** (PZ-T1…T10 done, Phase 3 open).
- PZ-T7: `SimulationInput.strategyParams?: { balancedWeights?: Record<Priority, number> }` with default 4/3/2/1.
  Hash is identical when absent or default; custom weights serialize canonically.
- PZ-T8: `InputPatch.criticalShares` and `balancedWeights` implemented in `applyPatch` and tested.
- PZ-T9: Strategy subset `run(strategies)` with checkbox per card (min 2); chart and summary support missing strategies.
- PZ-T10: "Strategy rules" section in panel (balanced weights sliders 0–10, critical share 0–100%); copilot
  `propose_change` tool updated with eval case.
- `make check` green (engine 123 tests, web 353 tests). 100% i18n key parity across EN/FR/MG.

## Next task

- Phase 3: PZ-T11…T14 — Sensitivity sweep (`sweep()` in engine, `SensitivityChart`, divergence callout, deferred perf).

## Decisions taken

- `canonicalJson`: skips `strategyParams` when undefined or matching default weights (4/3/2/1), preserving hash stability.
- Strategy subset checkbox is placed in each `StrategyCard` header with min-2 disable enforcement.
- `summarizeComparison`: handles missing `proportional`, `essential_first`, or `balanced` and evaluates any subset of ≥ 2 strategies.

## Files touched this session

- Engine: `packages/engine/src/{constants,schemas/input,hash,strategies/balanced,strategies/index,simulate,patch}.ts` + tests
- Web: `apps/web/src/features/strategy-lab/{ui/strategy-rules-section,ui/strategy-params-panel,ui/strategy-card,ui/strategy-lab-page,hooks/use-auto-compare,utils/summarize}.tsx?` + tests
- Chart: `apps/web/src/components/charts/strategy-comparison.tsx`
- Copilot: `apps/web/src/server/copilot/{tools,providers/mock}.ts` + eval tests
- i18n & docs: `messages/{en,fr,mg}.json`, `docs/contracts.md`, `docs/engine-spec.md`, `docs/tasks/PZ-strategy-params.md`, `docs/design/screens/strategy-lab.md`
