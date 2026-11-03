# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-03 (PI-I0 complete, PR #49 open) · **By:** Antigravity · **Branch:** feat/pi-0-placed-model

## Current state

- Branch `feat/pi-0-placed-model` rebased on latest `origin/main` (`a558cef`), PR #49 open.
- PI-T1 PlacedModel contract & store:
  - Visual store `usePlacedModelsStore` (`apps/web/src/stores/placed-models.store.ts`) with `localStorage` try/catch.
  - Helpers `sceneScale(archetype, proportions)` and `footprint(recipe, scale, yaw)`.
  - Wired to `ApplianceInsert` and `useSimulationAppliances` (upsert on insert with recipe, prune on delete).
  - Pure engine invariance confirmed: simulation & comparison results and hashes are 100% identical.
- PI-T2 Render 3D model in place:
  - `buildPlacedModelsGeometry` (`placed-models-geometry.ts`) reuses `recipeMesh` without duplication, positions on `terrainHeight` at lowest footprint point with slope plinths, reflects feeder departure states (dimmed if unserved, fire alert if on fire), LOD box on tier `low`.
  - Merges up to 30 placed models into 1 mesh (budget ≤ +2 draw calls respected).
  - Integrated in `ApplianceMarkers` (`appliance-markers.tsx`) and `village-canvas.tsx` across `/village`, `/simulation`, and overview preview.
- All checks pass: `pnpm typecheck`, `make lint`, `make check-i18n`, `make test-engine`, and tests green.

## Next

- Proceed with I1: PI-T3 (Dynamic zones `siteZones(placed)`), PI-T4 (Tree clearing), PI-T5 (Red laterite yard ground).

## Files touched (this session)

`apps/web/src/stores/{placed-models.store.ts,index.ts,__tests__/placed-models.store.test.ts}`,
`apps/web/src/features/microgrid-3d/{ui/appliance-markers.tsx,ui/village-canvas.tsx,utils/placed-models-geometry.ts,__tests__/{placed-models-geometry.test.ts,appliance-markers-ui.test.tsx}}`,
`apps/web/src/features/vision-insert/{ui/{appliance-insert.tsx,village-editor-page.tsx},hooks/use-simulation-appliances.ts,__tests__/appliance-insert.test.tsx}`,
`docs/contracts.md`, `docs/tasks/PI-village-integration.md`, `HANDOFF.md`.

## Decisions

- Placed models live exclusively in client visual store; engine remains strictly pure.
- Merged BufferGeometry ensures ≤ +2 draw calls even with 30 concurrent placed models in the village.
