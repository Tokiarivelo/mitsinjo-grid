# PT — Studio look: object & village render inspired by `teardown` (plan)

**Why (user, 2026-11-04):** « how does this person get 3D so detailed and perfect? Can we transcribe it to refine
our 3D generation? » Source studied: [elvarofficial/teardown](https://github.com/elvarofficial/teardown) (MIT, built
on `whaleyxbt/claude-motion`). Every file was read; findings below.
**Status:** ❌ planned. **Rules kept:** Meta models only; never paste the photo on a model (small swatches OK);
≤ 5 k triangles per object; budgets of `docs/performance.md` § 1 unchanged; dual theme; mobile; zero static text.
**Skills:** `/shape-3d` (object geometry) · `/scene-3d` (village) · `/shape-loop` (measure) · `/designer-3d` (review).

**Read first:** `docs/performance.md` § 5 · `.claude/rules/three.md` · this file. Nothing else.

## What `teardown` really does (and why it looks perfect)

It is **not** AI 3D generation: Claude hand-writes three.js code for one known machine, from a reference
photo or drawing and its real dimensions (mm). The quality comes from four things:

| Lever                   | How (file)                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| Real shapes, real sizes | Gears tooth by tooth, helical springs (`TubeGeometry`), lathed tyre, profiles extruded (`v8-shared/engine.js`) |
| **Bevel everywhere**    | Every `ExtrudeGeometry` has `bevelEnabled` (1–2 mm): each edge catches a highlight → « machined model » look   |
| Studio light            | PMREM env built from 4 white softbox planes, `NeutralToneMapping`, VSM shadow, GTAO (`v8-shared/stage.js`)     |
| **Ink outline**         | Post pass: depth Laplacian + normal breaks → dark edge (`strandbeest-shared/stage.js` `INK_FRAG`)              |
| Review loop             | Frame sheets read against a checklist until a pass finds nothing (`capture.mjs`, `sheet.mjs`)                  |

Plus: `MeshPhysicalMaterial` clearcoat on gloss parts, metal `roughness ≥ 0.45` on big surfaces, shader warm-up
before the first frame (`kit/warm.js`, `compileAsync`), quality tiers with frame-time downgrade (`live.js` `TIERS`).

## What we take, what we don't

| Take                                                                | Don't take (and why)                                                               |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Ink outline, softbox studio, clearcoat, bevel on the last bare body | Hand-coded per-object parts: we model any photographed object from templates (kit) |
| Shader warm-up, render checklist                                    | Kinematics, film/timeline, sound: no moving machine in our scope                   |
| Real-world size ranges per archetype                                | GTAO in the village: N8AO already does it cheaper                                  |
|                                                                     | Stencil section caps: no cut-away need today (stretch idea for the battery)        |

**Already there (no work):** rounded boxes (`ROUNDED_SEGMENTS = 2`), extrude bevel (`EXTRUDE_BEVEL`), edge radius per
surface (`SURFACE_LOOK.radius`), PMREM room light, Neutral tone mapping, baked contact shadow, N8AO + bloom,
2 tiers + fps auto-downgrade, `/shape-loop` contact sheet.

## Optimisation principles (apply to every task)

1. **Editor = `frameloop="demand"`** → a post pass costs only when something changes. Full quality is affordable there.
2. **Village = continuous (ambient 30 fps)** → only effects merged into the **existing** `EffectPass` (postprocessing
   merges effects into one shader): **+0 draw calls, +0 render targets**. High tier only; `low` tier untouched.
3. **Depth-only ink:** edges from the depth buffer the composer already has; normals rebuilt from depth derivatives
   in the shader → no `NormalPass` (`enableNormalPass` stays `false`), no extra scene render.
4. **Build once:** studio env PMREM once per canvas (≤ 128 px faces), materials shared per surface, never per frame.
5. **Physical material only where it shows:** clearcoat on the single editor object; the village keeps
   `MeshStandardMaterial` (thousands of instances).
6. **Measure before / after each task** (PT-0 numbers); any metric down > 2 points or a budget crossed → revert.

## Tasks

- [ ] **PT-0** Baseline. Run `make shape-report`, `SHOT_SUFFIX=before make shape-shots` (dev server on),
      `make scene-audit-gpu`; paste mean IoU, edge F1, ΔE, designer score, village fps / draw calls (both tiers) in
      the Loop log. **Done when** the numbers are logged.
- [ ] **PT-1** Bevel the silhouette body: `object-geometry.ts` silhouette `ExtrudeGeometry` (`bevelEnabled: false`
      today) → `bevelEnabled`, `bevelSegments: 1`, size = `EXTRUDE_BEVEL × max(w, h)`, depth reduced by 2 × bevel so
      the bbox is unchanged. **Done when** a test checks bbox equal ± 1e-6, triangles ≤ `MAX_TRIANGLES` on the
      fixtures, and the silhouette fallback shows lit edges in the editor.
- [ ] **PT-2** Softbox studio: pure `features/vision-insert/utils/studio-env.ts` → `buildStudioScene()` (top softbox,
      two side strips, low front kicker, grey floor disc; intensities as named constants), PMREM at sigma 0.02.
      Replaces `RoomEnvironment` in `StudioEnvironment` (`object-editor-3d.tsx`); dispose scene + target on unmount.
      **Done when** a test checks the mesh count and disposal; `make shape-shots` dark + light shows a clear highlight
      line on gloss parts (TV, fridge) and no blown-out white part.
- [ ] **PT-3** Surfaces: add `clearcoat` / `clearcoatRoughness` to `SurfaceLook` (painted, plastic, tile, glass,
      metal; 0 elsewhere); metal `roughness` 0.35 → 0.45 (teardown rule: big glossy metal streaks). Editor builds a
      `MeshPhysicalMaterial` only when `clearcoat > 0`, else standard. **Done when** a test asserts every surface has
      roughness in [0, 1], clearcoat 0 for matte surfaces, metal ≥ 0.45; ΔE in `shape-report` not worse.
- [ ] **PT-4** Ink outline effect: `features/microgrid-3d/utils/ink-effect.ts`, a `postprocessing` `Effect`
      (`EffectAttribute.DEPTH`): linear-depth Laplacian + depth-derived normal break, `strength` and ink colour as
      uniforms. Colour read once from the theme token (`--color-text-primary` resolved via `getComputedStyle`) and
      updated on theme change: no hex in TSX. One `<Ink />` wrapper, reused by both views. **Done when** the shader
      clamps every `pow` base (NaN guard), the uniform update is unit-tested, it compiles on SwiftShader.
- [ ] **PT-5** Ink in the editor: an `EffectComposer` (`multisampling` 4, `frameBufferType` HalfFloat, transparent
      clear kept for the `.viewer-studio` backdrop) with `<Ink strength≈0.6 />` only. Check alpha stays transparent
      in both themes; if it can't, fall back to an opaque clear in the backdrop token colour.
      **Done when** `make shape-shots` shows the outline in dark + light at 320 px and desktop, `designer-3d` ≥ +1.
- [ ] **PT-6** Ink in the village (high tier): add `<Ink strength≈0.35 />` inside the existing `PostEffects`
      `EffectComposer`, same `EffectPass` as Vignette. **Done when** `make scene-audit-gpu`: high tier fps drop
      ≤ 2 fps, draw calls unchanged, low tier identical to PT-0.
- [ ] **PT-7** Shader warm-up: hook `features/microgrid-3d/hooks/use-shader-warmup.ts` → once after mount,
      `await gl.compileAsync(scene, camera)` (uses `KHR_parallel_shader_compile`), canvas faded in after it resolves
      (≤ 1 s timeout, then show anyway). Used by the village and the editor. **Done when** a hook test (mock gl)
      covers resolve + timeout, and a Performance trace shows no long task > 100 ms on the first 3D frame.
- [ ] **PT-8** Real size ranges: `ARCHETYPE_SIZE_MM` in `lib/object-kit.ts` (e.g. cabinet 500–900 × 500–750 ×
      800–2000, tank Ø 600–2500…), used only to clamp **Spark-estimated** proportions; SAM-measured values are never
      overridden; the panel keeps labelling them « estimated ». **Done when** a test covers clamp + no-clamp on a
      measured value, and `shape-report` IoU not worse.
- [ ] **PT-9** Render checklist: add teardown's 3D checks to `.claude/skills/designer-3d/SKILL.md` (bloom emissive
      < 1, near-white parts on a pale backdrop need ink, metal roughness ≥ 0.45, shadow catcher `polygonOffset`,
      clamp `pow` in shaders, `smoothstep(a, b)` with a > b breaks on ANGLE). **Done when** the skill lists them.
- [ ] **PT-10** Close: docs (`docs/performance.md` § 5 ink + warm-up, `docs/design/*` 3D look), manual scenarios
      (`05`/`99-transverse`), `make check`, `HANDOFF.md`, tick boxes.

**Order:** PT-0 → PT-1 → PT-3 → PT-2 → PT-4 → PT-5 → PT-7 → PT-6 → PT-8 → PT-9 → PT-10 (cheap and safe first,
village last because it is on the demo path). **Cut order if late:** PT-8, PT-6, PT-7.

## Exit criteria

- Editor: designer score ≥ previous + 1; no `shape-report` metric down > 2 points on any object; ≤ 5 k triangles.
- Village: high tier ≥ 30 fps, draw calls unchanged; low tier unchanged; `make scene-audit` passes.
- Ink readable in dark and light, 320 px → 4K; no hardcoded colour; `make check` green.

## Loop log

| Date | Task | Mean IoU | Edge F1 | Mean ΔE | Designer | Village fps (high/low) | Note |
| ---- | ---- | -------- | ------- | ------- | -------- | ---------------------- | ---- |
