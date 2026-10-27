# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-27 · **By:** Claude (PR #10 review fixes, `fix/p7-review`) · **Day:** 8 / 10

## State

- Phase: **P7 — 3D Microgrid** completed (P7-T0..P7-T7 done; gate-out passed).
- Monorepo healthy: `make check` (84 engine + 144 web = 228 passing tests, 100% i18n parity, 0 lint/tsc errors), `pnpm build` clean.
- Features delivered:
  - Pure Scene Mapping: `toSceneModel(input, result, timeIndex)` maps solar glow, battery SoC, line flow animations, and building status with zero energy math in 3D components.
  - Three.js / R3F Digital Twin: Low-poly Madagascar-inspired village layout with terrain, instanced solar array, BESS battery container with 5-bar LED gauge, catenary overhead cables with animated flow, 5 canonical sector buildings with 2D HTML status badges and click selection.
  - Camera Controller: OrbitControls with constrained polar/distance limits, 4 presets (`village`, `solar`, `battery`, `essential`), and reset camera button (`aria-label="Reset camera"`).
  - Accessibility & Fallbacks: Full `prefers-reduced-motion` compliance, SSR dynamic loading, and automatic WebGL detection falling back to 2D topology/schematic without crashing.
  - Overview & Simulation Integration: Viewport toggle on `/simulation` and compact preview on `/overview`.
  - Next-intl timeZone fix: Added `DEFAULT_TIMEZONE = 'UTC'` to `NextIntlClientProvider` resolving `ENVIRONMENT_FALLBACK` warning.

## Next task

- `docs/tasks/P8-quality.md` (Days 8–9: Performance tuning, fluid responsiveness, cross-browser audits, accessibility a11y polish).

## Decisions taken

- Numbers come **strictly** from `@mitsinjo/engine`; 3D components consume pre-mapped `SceneModel` without calculating flows or metrics.
- WebGL detection uses `useSyncExternalStore` for SSR-safe zero-cascading-render state management.
- PR #10 review: canvas is `frameloop="demand"`; lines/camera tween call `invalidate()` only while moving.
  Solar panels instanced (4 draw calls). Scene status colors come from `utils/scene-palette.ts` (mirrors `@theme`).
  `status === 'modified'` dims the 3D scene + freezes flows. Reset camera re-applies preset via `cameraResetKey`.
  Folder is `microgrid-3d/{ui,hooks,utils}` (was `components/`).
- Default camera is isometric three-quarter view with smooth transitions for presets.

## Open questions / blockers

- Battery has no 3D text label for SoC status (spec asks "with label"); 2D views only. P8: add it + measure fps/draw calls.

## Files touched this session

- `apps/web/src/features/microgrid-3d/**`, `apps/web/src/features/simulation/ui/village-viewport.tsx`
- `apps/web/src/features/overview/ui/grid-schematic-preview.tsx`, `apps/web/src/lib/i18n.tsx`
- `apps/web/src/messages/{en,fr,mg}.json`, `docs/design/stitch-map.md`, `docs/tasks/P7-3d.md`, `HANDOFF.md`
- Review fix: `microgrid-3d/{ui,hooks,utils/scene-palette.ts}`, `simulation/ui/{village-viewport,simulation-page}.tsx`
