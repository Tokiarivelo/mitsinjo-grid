---
name: scene-3d
description: Build or change the React Three Fiber microgrid scene (buildings, solar array, battery, lines, camera, fallback) with data binding and performance budgets. Use for features/microgrid-3d.
---

Load only `docs/design/3d-scene.md` + mockup `design/stitch/live-simulation.png` (via `/design-check` gate-in).

1. Data: extend `utils/toSceneModel.ts` (pure, tested) — the scene never reads raw results.
2. Geometry: primitives (box/cylinder/plane) + shared materials; repeated items via `<Instances>`.
3. Binding: material emissive/color/scale from SceneModel; `invalidate()` after change (`frameloop="demand"`).
4. Interaction: `onClick` on building group → `selectSector(id)`; mirror in a keyboard-accessible 2D list. Touch controls must support orbit/pinch on mobile devices without trapping page scroll.
5. HTML overlays & HUD: tooltips, badges, floating cards and controls must use semantic `@theme` tokens (`bg-surface/90 text-text-primary border-border`), clean in both dark and light modes. Never use hardcoded dark colors.
6. Responsive viewport: canvas container must use adaptive heights (`min-h-[360px] sm:min-h-[460px] lg:min-h-[640px]`), camera presets/quality pills compact with touch targets ≥ 44px.
7. Motion: flow animation only when `flowKw > 0` and not reduced-motion; refs in `useFrame`, no setState.
8. Check budgets in dev: draw calls < 150, ≥ 45 fps, chunk lazily loaded. Fallback renders without WebGL.
9. Gate out: `/design-check` screenshot of /simulation vs mockup (desktop 1440×900 and mobile 390×844; dark and light themes).
