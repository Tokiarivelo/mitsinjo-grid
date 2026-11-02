# PV-G — 3D by script, piece by piece, checked against the 2D elevation (plan)

**Why (user, 2026-11-02):** the facade path (PR-2.23) now gets the silhouette roughly right, but the result is
not faithful to the imagined 2D elevation. Example: « rural thatched house » (8 m × 5.5 m, reed thatch 45°,
2 casement windows 900 × 1200 with 2 × 4 panes, timber double door 1600 × 2100 with glazed top, timber frame,
400 mm stone plinth, 2 brick chimneys, step). The 3D shows one box under a hip roof, **roof and walls with the
same blotchy photo texture**, three dark rectangles for windows and door. Ask: Spark writes a **generation
script**, builds the model **piece by piece**, and an agent loop renders → compares → corrects each piece until
the render matches; same for every kind of object.
**Status:** ❌ planned. **Rules kept:** Meta models only (Spark / Wonder, Muse Image, SAM 3.1); the LLM never
writes vertices or runnable code (it writes Zod-checked ops, the engine builds); pure, seeded, tested geometry;
never paste the photo on the model (small tileable swatches OK); ≤ 5 k triangles per object.
**Skills:** `/shape-3d` (vocabulary, files) · `/shape-loop` (scores, log) · `/facade-2d` (target image).

## Why the house looks like that (from the code)

| What the user sees                        | Cause                                                                                                                                                                                                                                                 | Where                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Roof texture = wall texture, blotchy      | Swatches are 64 px **photo** patches. The region of each material is the flat render's part map laid on the photo crop, and the facade recipe (elevation units + yaw) is not registered to the photo. The roof patch then picks walls, sky or shadow. | `photo-swatches.ts` `extractSwatches` / `findBestPatch`       |
| Diagonal diamond pattern on the roof      | Box-projected UVs (`MAP_TILE` 0.25) on sloped hip faces stretch the patch along the slope. High-contrast patches tile visibly.                                                                                                                        | `surface-maps.ts` (box UV), `blendHalfOffset`                 |
| Material not the drawn one (reed thatch)  | Materials come from Spark's kit roles `main` / `secondary` read on the photo. The 2D elevation (hatching, labels « REED THATCH ») is never read for materials.                                                                                        | `facade-house.ts` `role()`, `object-kit.ts` `materials`       |
| Windows and door = dark flat rectangles   | Decals 0.015 thick, glass at metalness 0.4 (dark mirror in the studio light). No frame, no mullions, no sill, no lintel, no recess. Door = one brown box, so the double leaves and the glazed top are lost.                                           | `facade-house.ts` `DECAL`, `glass`; `surface-look.ts` `glass` |
| No plinth, timber frame, step, roof bulge | Vocabulary has no such parts, and `MAX_RECIPE_PARTS = 12` is already filled by walls + roof + doors + chimneys + windows.                                                                                                                             | `object-shape.ts` `MAX_RECIPE_PARTS`, `RECIPE_SHAPES`         |
| Errors never caught against the 2D target | One-shot build. The only loop (Spark critic, PR-0.6) is 1 round of **kit** patches, judged on the **photo crop**, never on the validated elevation.                                                                                                   | `object-shape.ts` facade branch, `spark-critic.ts`            |

## Principle: script → build → render → compare → patch, one stage at a time

```
validated 2D elevation (front, + side) ──► SAM concepts per stage ──► target masks + Spark reading (labels, counts, materials)
                                                                                   │
Spark writes ShapeScript ops for stage k ──► engine compiles (pure) ──► recipe ──► elevation render (ortho, same frame as the 2D)
        ▲                                                                                          │
        └──── patch ops for stage k only ◄── Spark sees target | render | diff + per-stage scores ◄┘
stage k accepted (score ≥ gate or no gain after N rounds) ──► locked ──► stage k+1   (viewer shows each stage as it lands)
```

- **ShapeScript** = a JSON list of typed ops, not code: `add`, `set`, `remove`, `attach` (parent face + anchor),
  `cut` (opening in a wall), `repeat` (n along an axis), `material`. Zod-validated. Each op targets one named
  component, so a bad op breaks one piece, not the model. Never `eval`.
- **Stages (house):** S1 massing (walls box, plinth) → S2 roof (form, pitch, overhang, eave bulge) →
  S3 openings (cut windows + doors where SAM sees them) → S4 opening details (frame, panes grid, sill, lintel,
  door leaves, hinges skipped) → S5 accessories (chimneys, step, timber frame beams) → S6 materials (per
  component) → S7 hidden sides (side elevation, else graph rules PR-2.16).
- **Locks:** an accepted stage is frozen. Later patches may only touch their own stage, so S4 can't move a wall.
- **Monotone:** a patch is kept only if the stage score rises (as the critic already does). The per-stage cap is
  3 rounds, and the seed is the current `facadeHouseRecipe` output, so the result is never worse than today.

## Tasks

### G0 Measure against the 2D target (first: without it the loop is guesswork)

- [ ] **PG-T1 Elevation render.** `renderElevation(recipe, 'front'|'side', frame)` in `flat-render.ts`:
      orthographic, in the 2D image's own frame (the `Elevation` mapping of `facade-house.ts` inverted). It outputs a
      part-id map plus a line-art pass (silhouette and part edges) so it can be compared with a line drawing. Test:
      round-trip box → elevation → `measureElevation` gives back the same eave / walls / windows (± 1 px).
- [ ] **PG-T2 Elevation score.** `scoreElevation(target, render)`: global IoU, edge F1 against the drawing's
      edges, and **per-concept IoU** (roof, wall, window, door, chimney, plinth), with Hungarian matching of
      openings (count + position + size errors). Per stage it reports the metrics of that stage only. Golden
      tests on synthetic SVG elevations (thatched cottage = the user's sheet redrawn, shop, 2-storey, hut).
- [ ] **PG-T3 More SAM concepts on the elevation.** `FACADE_CONCEPTS.house` += roof, wall, plinth, chimney,
      window pane, door leaf, beam, step. Same `fetchPartMasks`, parallel, with the existing timeout. Bad or
      empty answers are dropped (logged miss cause, FIX 1 style).
- [ ] **PG-T4 Report + sheet.** `make shape-report` gains an « elevation » column (target | render | diff per
      stage). `make facade-e2e` writes `stages/` (one PNG per accepted stage) to watch the loop on live Meta.

### G1 Fix what is visibly wrong now (no loop needed, biggest gain per hour)

- [ ] **PG-T5 Materials from the 2D.** Spark reads the elevation (labels, hatching) → material per component
      (`roof: thatch`, `walls: plaster`, `frame: wood`, `plinth: stone`, `chimney: brick`). The elevation wins
      over the photo for _which_ material, and the photo keeps the _colour_ (measured ΔE).
- [ ] **PG-T6 Safe swatches.** A swatch region = SAM concept mask on the photo (`roof`, `wall`), not the
      flat-render part map. The swatch is rejected (back to procedural maps) when (a) the region is under 3 % of the
      crop, (b) the luminance spread is too high (shadows, objects), or (c) it is too close to another material's
      swatch (histogram distance under the threshold: roof ≈ wall). Contrast is clamped before tiling. Test: user
      case with roof and wall patches from the same pixels → rejected.
- [ ] **PG-T7 Slope UVs.** Per-face planar UV for `prism` / `hip`: u along the eave, v along the fall line, so
      thatch strands and slate rows run downhill. Box UV stays for vertical faces. No diagonal stretch.
- [ ] **PG-T8 Readable openings.** Openings are **recessed** (inset ≈ 0.04 of wall depth, reveal faces drawn)
      instead of decals. Glass = metalness 0, roughness 0.1, dark-blue tint, light reflection from the env map. The
      frame colour must reach ΔE ≥ 15 against the wall, or it is pushed lighter or darker. Test: frame vs wall
      contrast on the golden set.
- [ ] **PG-T9 Roof/wall contrast guard.** After colours: if ΔE(roof, wall) < 10 and the 2D says different
      materials, nudge the roof toward its procedural material base (thatch straw, slate grey). Logged as `estimated`.

### G2 Components instead of parts (lift the 12-part ceiling)

- [ ] **PG-T10 Assemblies.** New recipe component kinds that the engine expands into boxes:
      `window {cols, rows, frame, sill, lintel}`, `door {leaves, glazedRows, panels}`, `plinth {h}`,
      `beam {from, to}`, `step`, `chimney {cap}`, `roof {kind, pitch, overhang, bulge}`. The budget counts
      **components (≤ 32)**, triangles stay ≤ 5 k (a 2 × 4 window ≈ 10 boxes ≈ 120 tris). The schema keeps v1
      recipes valid, and the viewer and flat render expand both. Update `docs/contracts.md`.
- [ ] **PG-T11 Wall cuts.** Openings really cut the wall mesh (PR-2.17 openings, now in the viewer too): a
      rectangle hole + reveal, no z-fighting decal.
- [ ] **PG-T12 Thatch roof look.** `roof.bulge` (rounded eave lip, the drawing's curved edge), thickness, ridge
      cap. It uses the `thatch` procedural map with strands along v (PG-T7).

### G3 ShapeScript and the staged agent loop

- [ ] **PG-T13 ShapeScript schema + compiler.** `lib/shape-script.ts`: ops (`add`, `set`, `remove`, `attach`,
      `cut`, `repeat`, `material`), named components, parent-relative anchors (`wall.front @ u,v`), units
      = elevation fractions. `compileScript(ops) → ObjectRecipe` is pure, with constraints from the object graph
      (PR-2.14: an opening lies inside its wall, a chimney stands on the roof). An invalid op is dropped and
      reported, and the others apply. Tests: every op, every constraint, fuzzed bad ops never throw.
- [ ] **PG-T14 Seed = today's builder.** `facadeHouseRecipe` → equivalent ShapeScript (`recipeToScript`). The
      loop starts from it, so the floor is the current result.
- [ ] **PG-T15 Stage prompt.** One Spark call per round: target crop for the stage | render | diff overlay,
      the stage's scores, the locked components (read-only) and the stage's components (editable). It answers
      patch ops for this stage only. Prompt versioned (`SHAPE_SCRIPT_PROMPT_VERSION`). Eval on captures
      (`make eval-shape`), keeping the wording that raises the scores.
- [ ] **PG-T16 Loop runner.** `runShapeStages(seed, target, budget)`: S1…S7, ≤ 3 rounds per stage, keep a patch
      only if the stage score rises, stop a stage at its gate. The time budget is shared. Out of time → the rest
      keeps the seed. Deterministic given the same Spark answers (fixtures). Tests with a fake Spark: the score
      never goes down, locks hold, the timeout returns the best so far.
- [ ] **PG-T17 Progressive build in the UI.** SSE `ShapeStepEvent` gains `stage` + partial recipe. The viewer
      shows each accepted stage (massing → roof → openings → details). The panel names the current stage and its
      score. i18n en/fr/mg, both themes, mobile. Design gate: `/design-check`.
- [ ] **PG-T18 Background loop (decided, user 2026-11-02: option b).** The first answer keeps the 60 s budget
      (`SHAPE_TIMEOUT_MS`): seed + every stage done in time. The remaining stages continue on the server in the
      background (job id, same SSE stream, or poll on reconnect), and the viewer swaps in each accepted stage. The
      user can rotate, edit or place the object meanwhile, and a manual edit cancels the stages that would overwrite it.
      **Improvement indicator** (user ask): a visible chip on the 3D viewer and the panel reads « Amélioration :
      étape 3/7 — Ouvertures » with a progress bar, a spinner and the stage score before → after. When the loop
      ends it shows « Modèle finalisé » (or « Amélioration arrêtée : <cause> » on timeout or error), then fades
      out. It is announced to screen readers (`aria-live="polite"`), uses i18n en/fr/mg, theme tokens, and fits at 320 px.
      Tests: the hook follows the stage events, a dropped stream resumes from the last stage, and the chip
      reaches its final state on success and on error.

### G4 Every kind of object

- [ ] **PG-T19 2D target for all archetypes.** `ELEVATION_ARCHETYPES` today = house, building. Add vehicle,
      appliance, lamp/pole, tree, solar panel, battery, generic `other`. Muse Image draws a straight-on
      elevation (`/facade-2d`), and the user validates it as for houses.
- [ ] **PG-T20 Stage lists per archetype** (same runner, different stages and concepts):
      vehicle: body profile → cabin + glass → wheels → bumpers + lights → materials;
      appliance: body → doors / panels → handles + display → materials;
      tree: trunk → crown tiers → materials; lamp/pole: lathe profile → head → arm;
      solar panel: frame → cell grid → stand; other: free parts (`free-recipe.ts`) → details → materials.
- [ ] **PG-T21 Assemblies per archetype** (G2 pattern): `wheel {rim, tyre}`, `glass band`, `panel grid`,
      `handle`, `crown tier`, as needed by the scores, not up front.

### G5 Close

- [ ] **PG-T22 Loop pass.** `/shape-loop` on the golden set + the user's thatched house. Stop criteria below.
      `/designer-3d` review on the ¾ sheet.
- [ ] **PG-T23 Docs + scenarios.** `docs/contracts.md` (ShapeScript, components, SSE stage), `docs/copilot.md`
      (stage prompt), `/shape-3d` skill (vocabulary), README limits, `test-scenarios/06-village.md` (V96+).

## Stop criteria (per object, on the elevation)

Global IoU ≥ 0.9 · edge F1 ≥ 0.75 · every opening matched (count exact, centre error ≤ 3 % of width) · ΔE(roof,
wall) ≥ 10 when the 2D names different materials · frame vs wall ΔE ≥ 15 · designer ≥ 4/5 · ≤ 5 k triangles ·
first answer ≤ 60 s, background stages finish ≤ 3 min (PG-T18).
Thatched house acceptance: thatch roof with a rounded eave, clearly different from plastered walls. Two windows
with a 2 × 4 pane grid and sills, a double door with a glazed top, a stone plinth and two brick chimneys.

## Order

G0 (T1–T4, ≈ 1 day) → G1 (T5–T9: what the user sees today, no loop needed) → G2 (T10–T12) → G3 (T13–T18) → G4 one archetype at a time (vehicle next) → G5. Every task ends with a `/shape-loop`
measure and a row in `PV-shape-realism.md` « Loop log ».

## Non-goals

LLM-written JavaScript/Python executed on the server; GLB export; non-Meta image-to-3D models; pasting the
photo or the drawing on the model.
