# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-03 (PI-T3 dynamic site zones done on feat/pi-t3-site-zones) · **By:** Antigravity · **Branch:** feat/pi-t3-site-zones

## Current state

- PI-T3 completed: `siteZones(placed)` (`site-zones.ts`, Rule 2) single source of truth for keep-out zones.
  - Dynamic zone radius = model emprise (`footprint`) + archetype clearing margin (`ARCHETYPE_CLEARING_MARGIN`).
  - `snapAwayFromBuildings` respects dynamic zones, paths (`VILLAGE_PATHS`), pond and cross-relaxations.
  - `isBlocked` and `PlaceMinimap` read `siteZones`: minimap displays obstacles and warns when cursor is blocked.
  - 6 sector buildings positions and radii are strictly invariant; full collision test coverage (bâtiment, chemin, mare, deux objets).
  - Pure visual helper: engine invariant (`make test-engine` 353/353 green).

## Next

- P9-T5: video = `docs/tasks/PD-demo-video.md` (spec `video/VIDEO_PLAN.md`: rules, storyboard, voice-over, shots, pipeline); link in README line 15. P9-T6 (human): submit before Wed Nov 4 21:00 EST.
- PI I1 next: PI-T4 tree clearing (`siteZones` filters `scatterVegetation` instances with zero-scale in `InstancedMesh`), PI-T5 laterite yard (`docs/tasks/PI-village-integration.md`).
- Limit: inserted appliances are not persisted, so placed models don't survive a reload (localStorage is a cache).

## Files touched (this session)

`apps/web/src/features/microgrid-3d/utils/{site-zones.ts,landscape.ts,placement.ts,__tests__/site-zones.test.ts}`,
`apps/web/src/features/vision-insert/ui/place-minimap.tsx`, `docs/contracts.md`, `docs/tasks/PI-village-integration.md`, `HANDOFF.md`.

## Decisions

- Path clearance in `snapAwayFromBuildings` uses `PATH_HALF_WIDTH + clearance` with cross-push relaxation when obstacles overlap.
- `siteZones` always includes static `KEEP_OUT_ZONES` so building footprints, solar, battery, bus and pond are never violated.
