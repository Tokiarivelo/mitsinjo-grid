# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-03 (PR #49 follow-up: model pruning, flaky budget test, PI-T2 gate-out) · **By:** Claude Code · **Branch:** fix/pi-placed-models-followup

## Current state

- `main` has P9-T7 (README provenance, `benchmarks/`, Docker Compose `make docker-up`) and PI I0:
  - PI-T1 `usePlacedModelsStore` (`apps/web/src/stores/placed-models.store.ts`, localStorage try/catch), `sceneScale`, `footprint`.
  - PI-T2 `buildPlacedModelsGeometry` (`microgrid-3d/utils/placed-models-geometry.ts`): all placed models in one merged
    mesh, slope plinths in one instanced batch, model stands on its plinth, dimmed when idle/unserved, fire tint.
    Rebuilt only when `placedGeometryKey` changes; old geometry disposed. Engine untouched (invariance test).
- PR #49 review fixes: plinth draw calls (was 1 mesh each), model sunk in plinth, geometry rebuilt every render +
  GPU leak, idle appliance in served sector not dimmed, double remove, duplicated type, raw hex.

## Next

- P9-T5 (human): record the 3-min video; link in README line 15. P9-T6 (human): submit before Wed Nov 4 21:00 EST.
- PI I1: PI-T3 `siteZones(placed)`, PI-T4 tree clearing, PI-T5 laterite yard (`docs/tasks/PI-village-integration.md`).
- Follow-up done: placed models pruned on every input change except those undo can restore (`liveApplianceIds`);
  golden-shape budget uses best of 3 runs (full-suite CPU contention made it flaky); PI-T2 gate-out shots taken.
- Limit: inserted appliances are not persisted, so placed models don't survive a reload (localStorage is a cache).
  At the default ring position a small object sits among the houses; PI-T3 fixes placement.

## Files touched (this session)

`apps/web/src/features/microgrid-3d/{ui/appliance-markers.tsx,ui/village-canvas.tsx,utils/placed-models-geometry.ts,__tests__/*}`,
`apps/web/src/features/vision-insert/ui/appliance-insert.tsx`, `apps/web/src/stores/{placed-models.store.ts,__tests__/placed-models.store.test.ts}`,
`apps/web/src/server/perception/__tests__/golden-shape.test.ts`, `docs/contracts.md`, `docs/design/stitch-map.md`, `HANDOFF.md`.

## Decisions

- Benchmark: essential-first never serves the clinic worse than proportional; critical loads 73.3 % vs 73.7 % under
  `essential_stress` is reported as a trade-off in `benchmarks/README.md`.
- Placed models live only in a client visual store; plinth fills lowest → highest footprint point (+4 cm sink).
