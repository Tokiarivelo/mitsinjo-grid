# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-04 · **By:** Claude Code · **Branch:** fix/custom-element-views

## Current state

- Inserted appliances are now visible everywhere on /simulation:
  - 3D bottom chip bar lists them after the sectors (wraps); a chip flies the camera to the object.
  - Topology / Circuit: each appliance has a named card (dot, name, engine kW) wired to its feeder or the EMS
    (`utils/appliance-pills.ts`; circuit sector cards narrowed to 72 to free a column).
  - 3D ground: the yard under a placed object is red laterite and faces up (it was facing down → invisible),
    radius ≥ 2, plus a red track to the nearest village path (`utils/access-paths.ts`); trees cleared on both.
- 3D hand tool (hand icon next to reset): drag pans along the ground instead of orbiting.
- Multi-day fires: a fire reported on day D at hour H lives on the workflow days (D from H, later days all day)
  instead of an input event replayed every day from H (it vanished each night). `lib/day-events.ts`;
  scene, alerts and autopilot read the shown day's events; `clearFires` clears day fires too.
- `make check`: all green except `golden shapes (PF-T9) > car` timeout, which also fails on `main` (unrelated).

## Next

- P9-T5: video = `docs/tasks/PD-demo-video.md`. P9-T6 (human): submit before Wed Nov 4 21:00 EST.
- Limit: inserted appliances are not persisted (placed models don't survive a reload).
- Limit: topology draws cards for the first 12 appliances; later ones keep the small branch stub.

## Files touched (this session)

`apps/web/src/features/microgrid-3d/{ui/camera-controller.tsx,ui/grid-diagram.tsx,ui/placed-yards.tsx,ui/village-canvas.tsx,
utils/appliance-pills.ts,utils/access-paths.ts,utils/camera-focus.ts,utils/diagram-layout.ts,utils/placed-yards-geometry.ts,
utils/to-scene-model.ts}` + tests, `features/simulation/ui/village-viewport.tsx` + test, `features/fire-alert/hooks/use-fire-alerts.ts`,
`features/autopilot/use-autonomous-dispatch.ts`, `stores/simulation.store.ts`, `lib/day-events.ts` + test, `messages/{en,fr,mg}.json`,
`docs/contracts.md`, `docs/design/3d-scene.md`, `docs/design/screens/village.md`, `test-scenarios/02-simulation.md` (S102–S106).

## Decisions

- Appliance diagram cards: topology uses a nearest-free-spot search (tested: no overlap with boxes/wires); circuit uses fixed slots.
- Fire alert key is `fire:<sector>` so a fire crossing midnight does not re-notify.
- Undo of a restore (`clearFires`) also restores the workflow (snapshot in `AppliedChange.before.workflow`).
