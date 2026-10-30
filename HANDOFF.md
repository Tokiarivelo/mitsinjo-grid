# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-30 · **By:** Claude Code · **Branch:** `feat/lifeline-intensity-lighting` · **PR:** [#28](https://github.com/Tokiarivelo/mitsinjo-grid/pull/28) (reviewed, fixes pushed)

## State

- Plan `docs/tasks/PL-lifeline-dispatch.md`: **Phase 3 done** (PL-T9…PL-T13): intensity lighting
  (`glowFromIntensity`), pole lamps per feeder (`mapPolesToSectors`), electrons ∝ kW (`flowFactor`),
  lifeline amber dashed wires + mode badges on 2D cards.
- PR #28 review fixes: trunk-line street lamps stay lit while the bus is energized (were always dark);
  shared `flowFactor()` replaces duplicated kW/3 scaling; `NO_LOAD_KW` instead of 0.05; FlowWire owns
  lifeline/cut colors; named lamp hex constants; tests for lifeline wires + `flowFactor`.
- Owner requests added on the same PR: 3D EMS badge centered on the shelter front (was hanging below the
  pad); 2D Topology/Circuit zoom 100–400 % (buttons, Ctrl/⌘ + wheel, pinch), drag to pan, full screen
  (plain wheel zooms there); HUD/legend padding fix (`sm:p-4` overrode it).
- `useFullscreen` support check is hydration-safe (`useSyncExternalStore`, server snapshot false).
- Manual scenarios S54–S61 added (`test-scenarios/02-simulation.md`).

## Next task

- PL Phase 4 — Copilot, tests, doc (PL-T14…PL-T16).

## Decisions taken

- Trunk poles (no feeder) follow `lines.batteryToBus.active`; sector poles follow feeder intensity.
- Zoom keys `zoomIn/zoomOut/resetZoom` live in `common` (shared by diagram and copilot lightbox).
- Wheel zoom needs Ctrl/⌘ outside full screen so the page still scrolls; unzoomed diagram keeps
  `touch-pan-y` so one finger scrolls the page on mobile.

## Known issues

- Engine perf tests (`compare < 10 ms`, `sweep < 50 ms`) and two `simulation.test.tsx` cases time out
  under CPU load (parallel `make check`, dev server running); they pass alone.

## Files touched this session

- 3D/2D: `microgrid-3d/{utils/{scene-palette,zoom-pan}.ts,hooks/{use-zoom-pan,use-fullscreen}.ts,ui/{grid-diagram,flow-wire,electron-flow,distribution-lines,building-bodies,dispatch-controller-unit}.tsx}`
- `simulation/ui/village-viewport.tsx`, `copilot/ui/media-lightbox-modal.tsx`, messages `{en,fr,mg}.json`
- Docs: `docs/contracts.md`, `docs/design/screens/live-simulation.md`, `docs/design/stitch-map.md`
