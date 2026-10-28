---
paths:
  - 'apps/web/src/features/microgrid-3d/**'
---

# 3D rules (R3F + Drei)

- **Design gate:** spec `docs/design/3d-scene.md` + mockup `design/stitch/live-simulation.png` via `/design-check` before and after.
- Scene renders a `SceneModel` from `utils/toSceneModel(result, timeIndex)`. No energy math in components.
- `<Canvas frameloop="demand">`, `dpr` [1, 1.5] high · [1, 1.25] low; call `invalidate()` on data change; animate flows only when flow > 0 and motion allowed.
- In `useFrame`: mutate refs/materials, never `setState`. No object/vector allocation per frame.
- Repeated meshes (panels, houses, poles) → `<Instances>`/`InstancedMesh`. Share geometries and materials.
- Two quality tiers (`useSceneQuality`): `high` (default) may use one real-time sun shadow map,
  the HDRI env and `ui/post-effects.tsx` (N8AO, bloom, ACES, grade **after** tone mapping);
  `low` = one baked `ContactShadows` (`frames={1}`), no post-processing. Every new effect must
  have a `low` path and fit both budgets (`docs/performance.md`).
- Static repeated parts → merge once (`utils/merge-parts`) or instance; never one mesh per post/pane.
- Glow = color > 1 with `toneMapped={false}`, only on data-driven or light-source materials.
- Loaded with `next/dynamic({ ssr: false })` + Suspense fallback; WebGL check → 2D fallback component.
- `prefers-reduced-motion` → static scene, no camera tweening.
- **Dual Theming & HTML Overlays:** HUD badges, sector tooltips, and overlay controls rendered in or over the canvas must use semantic `@theme` tokens (`bg-surface/90 text-text-primary border-border`). Never use hardcoded hex/dark background values (`#0a101d`). Must adapt cleanly to both Dark and Light theme modes.
- **Responsive Mobile Viewport:** 3D canvas container height must be adaptive (`min-h-[360px] sm:min-h-[460px] lg:min-h-[640px]`). HUD controls, camera preset buttons, and quality pills must be compact, horizontally scrollable on mobile if needed, and have touch targets ≥ 44px. OrbitControls touch interactions (drag to orbit, pinch to zoom) must function smoothly on mobile touchscreens without hijacking page scroll.
- Budgets: `low` ≥ 45 fps on integrated GPU, < 150 draw calls; `high` < 400 calls, ≤ 800 k
  triangles (`?perf=1` overlay, `make scene-audit` / `make scene-audit-gpu`).
