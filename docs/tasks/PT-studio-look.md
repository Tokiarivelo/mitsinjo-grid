# PT — Studio look: object & village render inspired by `teardown`, plus the inserted object tag (plan)

**Why (user, 2026-11-04):** « how does this person get 3D so detailed and perfect? Can we transcribe it to refine
our 3D generation? » Source studied: [elvarofficial/teardown](https://github.com/elvarofficial/teardown) (MIT, built
on `whaleyxbt/claude-motion`). Every file was read; findings below.
**Status:** 🟡 all tasks done except PT-7 (warm-up shipped, first-mount long task still open) (2026-11-04). **Rules kept:** Meta models only; never paste the photo on a model (small swatches OK);
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

| Take                                                                                                       | Don't take (and why)                                                               |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Ink outline, softbox studio, clearcoat, bevel on the bare shapes (hull, cylinder, cone, prism, silhouette) | Hand-coded per-object parts: we model any photographed object from templates (kit) |
| Shader warm-up, render checklist                                                                           | Kinematics, film/timeline, sound: no moving machine in our scope                   |
| Real-world size ranges per archetype                                                                       | GTAO in the village: N8AO already does it cheaper                                  |
|                                                                                                            | Stencil section caps: no cut-away need today (stretch idea for the battery)        |

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

- [x] **PT-0** Baseline. Run `make shape-report`, `SHOT_SUFFIX=before make shape-shots` (dev server on),
      `make scene-audit-gpu`; paste mean IoU, edge F1, ΔE, designer score, village fps / draw calls (both tiers) in
      the Loop log. **Done when** the numbers are logged.
- [ ] **PT-1** Soft edges on **every** object path (any object from vision, template or 2D view). Today in
      `object-geometry.ts`: `box` (rounded), `extrude` and `lathe` are bevelled; `hull`, `cylinder`, `cone`, `prism`,
      `hip` and the silhouette body have sharp edges. One shared constant `EDGE_BEVEL` (share of the part's smallest
      side, capped by `SURFACE_LOOK.radius`), one bevel ring (`bevelSegments: 1`), bbox always unchanged.
      **Common Done when** (one test per shape): bbox equal ± 1e-6, ≤ `MAX_TRIANGLES` on all fixtures, edge
      normals no longer at 90° (angle between cap and side normals < 60° on the bevel ring), `shape-report` not worse.
  - [x] **PT-1a** `hull` (`unitHull`, the « any object » path, PV-H): add one inset loop at each end (end loop scaled
        toward its centre by the bevel, pulled back by the same z) and build the caps from it. Cost: + 4 × n triangles
        (n = loop size), no new pass. Skin patches (`body = false`) keep sharp edges (too small to see).
  - [x] **PT-1b** `cylinder` / `cone`: replace `CylinderGeometry` / `ConeGeometry` by the existing `unitLathe` on a
        chamfered profile (4–6 points, same `ROUND_SEGMENTS`): reuse, no new geometry code. Wheels, poles and tanks gain
        the highlight ring.
  - [x] **PT-1c** `prism`: build it with the existing bevelled `unitExtrude` on its triangle profile (apex as the
        third point) instead of hand-built faces. Reuse only.
  - [x] **PT-1d** Silhouette body (`silhouetteMesh`, `bevelEnabled: false` today) → `bevelEnabled`, size =
        `EDGE_BEVEL × max(w, h)`, depth reduced by 2 × bevel.
  - [x] **PT-1e** `hip` (hipped roof): no bevel geometry (clip planes make it costly); its edges are carried by the
        ink outline (PT-5). Done when a `shape-shots` check shows the ridge and hips read in both themes.
- [x] **PT-2** Softbox studio: pure `features/vision-insert/utils/studio-env.ts` → `buildStudioScene()` (top softbox,
      two side strips, low front kicker, grey floor disc; intensities as named constants), PMREM at sigma 0.02.
      Replaces `RoomEnvironment` in `StudioEnvironment` (`object-editor-3d.tsx`); dispose scene + target on unmount.
      **Done when** a test checks the mesh count and disposal; `make shape-shots` dark + light shows a clear highlight
      line on gloss parts (TV, fridge) and no blown-out white part.
- [x] **PT-3** Surfaces: add `clearcoat` / `clearcoatRoughness` to `SurfaceLook` (painted, plastic, tile, glass,
      metal; 0 elsewhere); metal `roughness` 0.35 → 0.45 (teardown rule: big glossy metal streaks). Editor builds a
      `MeshPhysicalMaterial` only when `clearcoat > 0`, else standard. **Done when** a test asserts every surface has
      roughness in [0, 1], clearcoat 0 for matte surfaces, metal ≥ 0.45; ΔE in `shape-report` not worse.
- [x] **PT-4** Ink outline effect: `features/microgrid-3d/utils/ink-effect.ts`, a `postprocessing` `Effect`
      (`EffectAttribute.DEPTH`): linear-depth Laplacian + depth-derived normal break, `strength` and ink colour as
      uniforms. Colour read once from the theme token (`--color-text-primary` resolved via `getComputedStyle`) and
      updated on theme change: no hex in TSX. One `<Ink />` wrapper, reused by both views. **Done when** the shader
      clamps every `pow` base (NaN guard), the uniform update is unit-tested, it compiles on SwiftShader.
- [x] **PT-5** Ink in the editor: an `EffectComposer` (`multisampling` 4, `frameBufferType` HalfFloat, transparent
      clear kept for the `.viewer-studio` backdrop) with `<Ink strength≈0.6 />` only. Check alpha stays transparent
      in both themes; if it can't, fall back to an opaque clear in the backdrop token colour.
      **Done when** `make shape-shots` shows the outline in dark + light at 320 px and desktop, `designer-3d` ≥ +1.
- [x] **PT-6** Ink in the village (high tier): add `<Ink strength≈0.35 />` inside the existing `PostEffects`
      `EffectComposer`, same `EffectPass` as Vignette. **Done when** `make scene-audit-gpu`: high tier fps drop
      ≤ 2 fps, draw calls unchanged, low tier identical to PT-0.
- [ ] **PT-7** Shader warm-up: hook `features/microgrid-3d/hooks/use-shader-warmup.ts` → once after mount,
      `await gl.compileAsync(scene, camera)` (uses `KHR_parallel_shader_compile`), canvas faded in after it resolves
      (≤ 1 s timeout, then show anyway). Used by the village and the editor. **Done when** a hook test (mock gl)
      covers resolve + timeout, and a Performance trace shows no long task > 100 ms on the first 3D frame.
      🟡 2026-11-04: hook + fade-in shipped, tests green. Trace (GTX 960M, `/overview?quality=high`): one
      1.2–1.3 s long task when the canvas mounts **with or without** the warm-up (1.18–1.22 s without) → it is
      scene building (geometry / React), not shaders. Left open: profile that task before ticking.
- [x] **PT-8** Real size ranges: `ARCHETYPE_SIZE_MM` in `lib/object-kit.ts` (e.g. cabinet 500–900 × 500–750 ×
      800–2000, tank Ø 600–2500…), used only to clamp **Spark-estimated** proportions; SAM-measured values are never
      overridden; the panel keeps labelling them « estimated ». **Done when** a test covers clamp + no-clamp on a
      measured value, and `shape-report` IoU not worse.
- [x] **PT-9** Render checklist: add teardown's 3D checks to `.claude/skills/designer-3d/SKILL.md` (bloom emissive
      < 1, near-white parts on a pale backdrop need ink, metal roughness ≥ 0.45, shadow catcher `polygonOffset`,
      clamp `pow` in shaders, `smoothstep(a, b)` with a > b breaks on ANGLE). **Done when** the skill lists them.
- [x] **PT-11** Same tag for an inserted object as for a village building (user, 2026-11-04: « the label is not the
      same, no icon, different elevation, no critical / medium / high info at the bottom »). Today
      (`appliance-markers.tsx` « HTML tags »): a plain text `name · qty × W` at `height + 0.35`, no icon, no status, no
      priority, not clickable. Buildings (`buildings.tsx` `BuildingFrame`): beacon sphere at `ledY`, glass badge at
      `ledY + 0.75` with sector icon, name, AI badge, status dot, priority (critical in red) and coverage.
      Gate: `/design-check` (spec + mockup before, desktop + 390 px, dark + light shots after).
  - [x] **PT-11a** Extract the building badge **once** into `features/microgrid-3d/ui/scene-badge.tsx` (props: icon,
        title, status colour, priority label + level, metric text, selected / alert, onClick; tokens only) and use it
        in `buildings.tsx` with no visual change (screenshot diff = 0). No duplicated markup.
  - [x] **PT-11b** Data, pure and tested: `applianceMarkers()` (`utils/appliance-markers.ts`) adds `priority`
        (its **sector's** engine input priority: an appliance has none of its own, no engine change, no migration),
        `status` (`StatusColor`: running → green, sector partly served → amber, unserved → red, off → idle) and
        `inAlert` (its sector's alert / fire). Every value from the engine input / result, none computed in UI.
  - [x] **PT-11c** Icon: `components/ui/appliance-icon.tsx`, one lucide icon per `ApplianceCategory` (fridge, TV,
        lamp, fan, laptop, pump, mill…; `other` → plug), on its sector's icon background (`SECTOR_ICON_BG`). Reuse
        in `vision-insert/ui/appliance-list.tsx` where it helps.
  - [x] **PT-11d** Elevation: one shared rule `badgeY(top) = top + BEACON_GAP` and `beaconY(top)`, exported from
        `scene-badge.tsx` and used by both; the appliance top comes from `modelBounds[id].height` (real 3D model)
        or the box marker. Beacons of all appliances in **one** `Instances` (+1 draw call total, not per object).
  - [x] **PT-11e** Wire it in `appliance-markers.tsx`: `SceneBadge` with `ApplianceIcon`, name, bottom line
        `priority · fmtKw(kwNow)` (formatted with unit, `@/lib/format`), selected ring, alert pulse; click selects the
        marker (same handler as `bindMarker`), hit area ≥ 44 px on touch. Keep `MARKER_TAGS_ALL_MAX` (DOM cost:
        each `<Html>` is a layout per frame); memo the badge so it re-renders only when its fields change.
        i18n: reuse the existing priority / disconnected keys; any new key (aria-label) in `en` / `fr` / `mg`
        (`make check-i18n`).
        **Done when** tests cover `applianceMarkers()` priority / status / alert and the badge render (icon, priority
        text, critical in red); `make shots` shows building and object tags identical in style and height;
        `make scene-audit` draw calls ≤ previous + 1.
- [x] **PT-10** Close: docs (`docs/performance.md` § 5 ink + warm-up, `docs/design/*` 3D look and object tag),
      `docs/contracts.md` (`ApplianceMarkerSceneModel` fields), manual scenarios (`02-simulation` object tag,
      `05`/`99-transverse` look), `make check`, `HANDOFF.md`, tick boxes.

**Order:** PT-0 → PT-11 (user-visible bug, independent of the render work) → PT-1 → PT-3 → PT-2 → PT-4 → PT-5 →
PT-7 → PT-6 → PT-8 → PT-9 → PT-10 (cheap and safe first, village render last because it is on the demo path).
Inside PT-1: 1a (most objects without a template) → 1b → 1d → 1c. Inside PT-11: a → b → c → d → e.
**Cut order if late:** PT-8, PT-6, PT-7, PT-1c. Never cut PT-11.

## Exit criteria

- Editor: designer score ≥ previous + 1; no `shape-report` metric down > 2 points on any object; ≤ 5 k triangles.
- Any detected object gets the same finish, whatever its path (template, 2D-view hull, silhouette fallback,
  `other` archetype): soft edges on every body shape except `hip` (ink), studio light, clearcoat by surface, ink.
- Village: high tier ≥ 30 fps, draw calls unchanged; low tier unchanged; `make scene-audit` passes.
- Ink readable in dark and light, 320 px → 4K; no hardcoded colour; `make check` green.
- An inserted object's tag matches a building's: same badge component, icon, height rule, status dot and priority
  line (critical / high / medium / low) from the engine; clickable; dark + light, 320 px → 4K.

## Loop log

| Date       | Task                   | Mean IoU | Edge F1 | Mean ΔE | Designer | Village fps (high/low)                                                                       | Note                                                                                                                                             |
| ---------- | ---------------------- | -------- | ------- | ------- | -------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-04 | PT-0 baseline          | 0.98     | 0.91    | 3.4     | 3/5      | 10–25 / 17–26 (dev server; 192–209 / 143–148 calls)                                          | white fridge melts into the pale backdrop; car reads flat                                                                                        |
| 2026-11-04 | PT-1a hull bevel       | 0.98     | 0.91    | 3.4     | 3/5      | — (no village change)                                                                        | `EDGE_BEVEL` 0.06 + `edgeBevel()`; no report fixture uses a hull body → proven by tests only                                                     |
| 2026-11-04 | PT-1b round rims       | 0.98     | 0.91    | 3.4     | 3/5      | — (no village change)                                                                        | `roundProfile()` chamfer on `unitLathe` (24 seg.); axis parts (wheels, handles) bevelled too                                                     |
| 2026-11-04 | PT-1d silhouette bevel | 0.98     | 0.91    | 3.4     | 3/5      | — (no village change)                                                                        | `bevelOffset: -b` keeps the outline; b = min(EDGE_BEVEL × max(w, h), depth / 4) for thin bodies                                                  |
| 2026-11-04 | PT-1c prism bevel      | 0.98     | 0.91    | 3.4     | 3/5      | — (no village change)                                                                        | prism = `unitExtrude(triangle, inset)` (8 → 20 triangles); inset bevel keeps unit bounds, ≤ `PRISM_BEVEL_MAX`                                    |
| 2026-11-04 | PT-3 clearcoat         | 0.98     | 0.91    | 3.4     | 3/5      | — (no village change)                                                                        | `surfaceMaterial()`: physical only on painted / plastic / tile / glass / metal; metal roughness 0.45                                             |
| 2026-11-04 | PT-2 softbox studio    | 0.98     | 0.91    | 3.4     | 3/5      | — (no village change)                                                                        | `buildStudioScene()` replaces RoomEnvironment, sigma 0.02; first try too dark (fill 0.32), fill 0.6 + kicker 2.4 keeps white white               |
| 2026-11-04 | PT-4/5 editor ink      | 0.98     | 0.91    | 3.4     | 4/5      | — (no village change)                                                                        | ink 0.6 after Neutral tone mapping, alpha kept; compiles on SwiftShader; crease term raised (0.7 → 1, 0.45–0.85) after shots                     |
| 2026-11-04 | PT-1e hip check        | 0.98     | 0.91    | 3.4     | 4/5      | —                                                                                            | no bevel geometry; `shape-shots` thatched house + cottage row: ridge and hips read by the ink, dark + light, 1440 and 320 px                     |
| 2026-11-04 | PT-7 warm-up (open)    | 0.98     | 0.91    | 3.4     | 4/5      | first-mount long task 1.22–1.32 s (with) vs 1.18–1.22 s (without), GPU                       | `compileAsync` + fade-in; the long task is scene building, not shader compile                                                                    |
| 2026-11-04 | PT-6 village ink       | —        | —       | —       | 4/5      | high 24–26 / 29 (was 23–24 / 28–29), low 22–25 / 29; calls 192 / 209 and 143 / 148 unchanged | first try (text-primary, creases, no fade) = white snow over the forest → `scene-ink` token, crease 0, fade 22–45                                |
| 2026-11-04 | PT-8 size ranges       | 0.98     | 0.91    | 3.4     | 4/5      | —                                                                                            | `clampEstimatedDepth()` in `parseKit` / `mergeKitPatch` only (Spark depth); ratio bounds from `ARCHETYPE_SIZE_MM`; measured side views untouched |
