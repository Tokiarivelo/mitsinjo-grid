---
name: scene-3d
description: Build or change the React Three Fiber microgrid scene (buildings, solar array, battery, lines, camera, fallback) with data binding and performance budgets. Use for features/microgrid-3d.
---

Load only `docs/design/3d-scene.md` + mockup `design/stitch/live-simulation.png` (via `/design-check` gate-in).

1. Data: extend `utils/toSceneModel.ts` (pure, tested) — the scene never reads raw results.
2. Geometry: primitives (box/cylinder/plane) + shared materials; repeated items via `<Instances>`.
3. Binding: material emissive/color/scale from SceneModel; `invalidate()` after change (`frameloop="demand"`).
4. Interaction: `onClick` on building group → `selectSector(id)`; mirror in a keyboard-accessible 2D list.
5. Motion: flow animation only when `flowKw > 0` and not reduced-motion; refs in `useFrame`, no setState.
6. Check budgets in dev: draw calls < 150, ≥ 45 fps, chunk lazily loaded. Fallback renders without WebGL.
7. Gate out: `/design-check` screenshot of /simulation vs mockup.
