---
paths:
  - 'apps/web/src/features/microgrid-3d/**'
---

# 3D rules (R3F + Drei)

- **Design gate:** spec `docs/design/3d-scene.md` + mockup `design/stitch/live-simulation.png` via `/design-check` before and after.
- Scene renders a `SceneModel` from `utils/toSceneModel(result, timeIndex)`. No energy math in components.
- `<Canvas frameloop="demand" dpr={[1, 1.75]}>`; call `invalidate()` on data change; animate flows only when flow > 0 and motion allowed.
- In `useFrame`: mutate refs/materials, never `setState`. No object/vector allocation per frame.
- Repeated meshes (panels, houses, poles) → `<Instances>`/`InstancedMesh`. Share geometries and materials.
- Shadows: one `ContactShadows` (baked, `frames={1}`), no realtime shadow maps. No postprocessing by default.
- Loaded with `next/dynamic({ ssr: false })` + Suspense fallback; WebGL check → 2D fallback component.
- `prefers-reduced-motion` → static scene, no camera tweening.
- Target ≥ 45 fps on integrated GPU, < 150 draw calls (`gl.info.render.calls` in dev overlay).
