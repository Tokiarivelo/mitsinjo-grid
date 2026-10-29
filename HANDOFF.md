# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-28 · **By:** Claude Code · **Branch:** `feat/strategy-lab-params` · **PR:** [#22](https://github.com/Tokiarivelo/mitsinjo-grid/pull/22)

## State

- New plan `docs/tasks/PZ-strategy-params.md` (3 phases). **Phase 1 done** (PZ-T1…T6), phases 2–3 open.
- `/strategies` now has a collapsible **Comparison parameters** panel: 6 condition sliders + per-sector
  priority select and power cap (max kW, from–to h). Each edit patches the input and re-runs all strategies after 300 ms.
- Best-value badges: every tied winner gets it, none when all strategies tie (baseline shows no badge).
- Condition sliders extracted once (`useConditionControls` + `ConditionControlsGrid` + `usePatchValidation`) and reused by
  SimControlsPanel, AssumptionsInspector and StrategyParamsPanel (old copies deleted).
- `make check` green (engine 116, web 348 tests). i18n parity OK. Visual check 1440/390/320 px, dark + light, 0 overflow.

## Next task

- Review and merge PR #22 once CI (incl. e2e) is green.
- Phase 2 (`/engine-change`): PZ-T7…T10 — balanced weights, critical shares, strategy subset.

## Decisions taken

- Owner: no Stitch mockup for PZ, design system only (noted in `docs/design/stitch-map.md`).
- No engine change in phase 1: everything goes through existing `InputPatch` (`priorities`, `sectorCaps`).
- One cap per sector in the editor (`withSectorCap` replaces it); default cap 1 kW 18–22 h.
- `summarizeComparison` best\* fields are now `StrategyId[]`; recommendation logic unchanged.

## Files touched this session

- Strategy lab: `features/strategy-lab/{ui/strategy-params-panel,ui/sector-rule-row,hooks/use-auto-compare,utils/sector-caps,utils/summarize}.ts(x)`, page, card, tests
- Shared: `features/simulation/{hooks/use-condition-controls,hooks/use-patch-validation,ui/condition-controls-grid}`, `sim-controls-panel.tsx`, `features/scenarios/ui/assumptions-inspector.tsx`
- i18n: `messages/{en,fr,mg}.json` (`strategies.params.*`)
- Docs: `docs/tasks/PZ-strategy-params.md`, `docs/tasks/README.md`, `docs/design/screens/strategy-lab.md`, `docs/design/components.md`, `docs/design/stitch-map.md`, `README.md`
