# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-03 (PI I1 completed: PI-T3, PI-T4, PI-T5 on feat/pi-t3-site-zones) · **By:** Antigravity · **Branch:** feat/pi-t3-site-zones

## Current state

- PI I1 completed:
  - PI-T3: `siteZones(placed)` (`site-zones.ts`, Rule 2) single source of truth for keep-out zones.
    Dynamic radius = model emprise (`footprint`) + archetype clearing margin (`ARCHETYPE_CLEARING_MARGIN`).
    `snapAwayFromBuildings` respects dynamic zones, paths, pond and cross-relaxations.
    `isBlocked` and `PlaceMinimap` read `siteZones`. 6 building positions/radii invariant (9/9 unit tests).
  - PI-T4: Tree clearing (`scatter.ts`, `vegetation.tsx`). Instances inside clearings masked to scale 0 in
    `InstancedMesh` without forest regeneration. Removing object restores trees immediately (4/4 tests).
  - PI-T5: Laterite yards (`placed-yards-geometry.ts`, `placed-yards.tsx`). Draped at `terrainHeight + 0.03`
    (+3 cm, zero z-fighting), `fbm2d` natural irregular border, `GROUND_HEX.yard` tint, merged into 1 draw call
    (≤ +1 draw call budget satisfied; 4/4 tests).
  - Engine untouched: `make test-engine` 353/353 green.

## Next

- P9-T5: video = `docs/tasks/PD-demo-video.md` (spec `video/VIDEO_PLAN.md`: rules, storyboard, voice-over, shots, pipeline); link in README line 15. P9-T6 (human): submit before Wed Nov 4 21:00 EST.
- PI I2: PI-T6 `tapPoint(position, sector, mode)`, PI-T7 poles & cables derivation, PI-T8 UI wiring (`docs/tasks/PI-village-integration.md`).
- Limit: inserted appliances are not persisted, so placed models don't survive a reload (localStorage is a cache).

## Files touched (this session)

`apps/web/src/features/microgrid-3d/{ui/vegetation.tsx,ui/village-canvas.tsx,ui/placed-yards.tsx,utils/*}`,
`apps/web/src/features/vision-insert/ui/place-minimap.tsx`, `docs/contracts.md`, `docs/tasks/PI-village-integration.md`, `HANDOFF.md`.

## Decisions

- PR #52 review: site zones are now live everywhere a spot is chosen (drag `useMoveMarker`, insert `setPosition`, minimap) via `hooks/use-site-zones` (`readSiteZones`, `useSiteZones`, `usePlacedClearings`), own zone excluded by id. `snapAwayFromBuildings(pos, clearance, options)` takes only `SnapOptions`.

- Tree clearing masks instances via `clearingItemScale` to scale 0 in-place: zero forest regeneration, 0 fps impact.
- Placed yards are draped over the terrain relief (+3 cm) and merged into a single BufferGeometry (1 draw call).
