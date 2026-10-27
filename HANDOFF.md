# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-27 · **By:** Claude (P7 follow-ups, `fix/p7-followups`) · **Day:** 8 / 10

## State

- Phase: **P7 — 3D Microgrid** completed (P7-T0..P7-T7 done; gate-out passed).
- Monorepo healthy: `make check` green (tests, i18n parity, lint, tsc), `pnpm build` clean.
- Features delivered:
  - Pure Scene Mapping: `toSceneModel(input, result, timeIndex)` maps solar glow, battery SoC, line flow animations, and building status with zero energy math in 3D components.
  - Three.js / R3F Digital Twin: Low-poly Madagascar-inspired village layout with terrain, instanced solar array, BESS battery container with 5-bar LED gauge, catenary overhead cables with animated flow, 5 canonical sector buildings with 2D HTML status badges and click selection.
  - Camera: OrbitControls with limits, 4 presets, reset camera. `?perf=1` shows draw calls/fps; `make scene-audit` checks budget + screenshots.
  - Accessibility & Fallbacks: Full `prefers-reduced-motion` compliance, SSR dynamic loading, and automatic WebGL detection falling back to 2D topology/schematic without crashing.
  - Overview & Simulation Integration: Viewport toggle on `/simulation` and compact preview on `/overview`.

## Next task

- `docs/tasks/P8-quality.md` (Days 8–9: Performance tuning, fluid responsiveness, cross-browser audits, accessibility a11y polish).

## Decisions taken

- Numbers come **strictly** from `@mitsinjo/engine`; 3D components consume pre-mapped `SceneModel` without calculating flows or metrics.
- WebGL detection uses `useSyncExternalStore` for SSR-safe zero-cascading-render state management.
- PR #10 review: canvas is `frameloop="demand"`; lines/camera tween call `invalidate()` only while moving.
  Solar panels instanced (4 draw calls). Scene status colors come from `utils/scene-palette.ts` (mirrors `@theme`).
  `status === 'modified'` dims the 3D scene + freezes flows. Reset camera re-applies preset via `cameraResetKey`.
  Folder is `microgrid-3d/{ui,hooks,utils}` (was `components/`). In-scene `<Html>` labels use a stable
  `portal` ref (fixes empty battery label + dev "unmount a root" errors). No result → badges show "—".

## Open questions / blockers

- fps on a real integrated GPU still needs a manual check: open `/simulation?perf=1` on a laptop (target ≥45 fps).
  `make scene-audit`: 97 draw calls, 6.2k triangles (SwiftShader fps is not meaningful).

## Files touched this session

- `apps/web/src/features/microgrid-3d/**`, `apps/web/src/features/simulation/ui/village-viewport.tsx`
- `apps/web/src/features/overview/ui/grid-schematic-preview.tsx`, `apps/web/src/lib/i18n.tsx`
- `apps/web/src/messages/{en,fr,mg}.json`, `docs/design/stitch-map.md`, `docs/tasks/P7-3d.md`, `HANDOFF.md`
- Review fix: `microgrid-3d/{ui,hooks,utils/scene-palette.ts}`, `simulation/ui/{village-viewport,simulation-page}.tsx`
