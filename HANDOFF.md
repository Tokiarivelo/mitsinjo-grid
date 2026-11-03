# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-03 (PI I2 completed: PI-T6, PI-T7, PI-T8 on feat/pi-i2-poles-cables) · **By:** Antigravity · **Branch:** feat/pi-i2-poles-cables

## Current state

- PI I2 completed across 3 dedicated commits:
  - PI-T6: `tapPoint(position, sector, mode, options)` (`tap-point.ts`). Branch mode (closest branch pole / sector building), EMS mode (`BUS_POSITION`), obstacle contouring with corner pole waypoints (`contourWaypoint`), zero poles if collé au bâtiment (≤ 4.5m). 10/10 tests.
  - PI-T7: `buildApplianceDerivations` (`tap-point.ts`), catenary cables (`routeCable`), intermediate poles (≤ 4.5m) in `mapPolesToSectors` with appliance sector (street lamps follow feeder status), straight wire removed, electrons along active derivations (`ElectronFlow`). 17/17 tests.
  - PI-T8: Grid connection selector in `ApplianceInsertPanel` (`branch` recommended vs `ems` direct), D1 load reminder (charge remains on `sector`), 100% key parity (EN/FR/MG), dual theme, min-h-[44px], drag commit recalculates. 17/17 tests.
  - Engine untouched: `make test-engine` 353/353 green.

## Next

- PI I3: PI-T9 (2D diagram & minimap branch depiction), PI-T10 (quality pass, `/designer-3d`, `/perf-audit`, screenshots).
- P9-T5: video = `docs/tasks/PD-demo-video.md` (spec `video/VIDEO_PLAN.md`: rules, storyboard, voice-over, shots, pipeline); link in README line 15. P9-T6 (human): submit before Wed Nov 4 21:00 EST.
- Limit: inserted appliances are not persisted, so placed models don't survive a reload (localStorage is a cache).

## Files touched (this session)

`apps/web/src/features/microgrid-3d/{ui/distribution-lines.tsx,ui/appliance-markers.tsx,ui/village-viewport.tsx,utils/*}`,
`apps/web/src/features/vision-insert/{ui/appliance-insert-panel.tsx,ui/appliance-insert.tsx,utils/appliance-draft.ts,hooks/use-appliance-draft.ts}`,
`apps/web/src/stores/placed-models.store.ts`, `apps/web/src/messages/{en.json,fr.json,mg.json}`, `docs/contracts.md`, `docs/tasks/PI-village-integration.md`, `HANDOFF.md`.

## Decisions

- D1 Decision: Direct EMS mode (`ems`) connects visually to `BUS_POSITION`, but load remains accounted on appliance `sector`.
- Leaf module decoupling: `site-positions.ts` exports `feederExitPosition`, `FEEDER_EXIT_X/Z` avoiding import cycle with `to-scene-model.ts`.
- Zero additional draw calls: Derivations merge into `lines.appliancePoles` and `lines.applianceDerivations` with instanced mesh.
