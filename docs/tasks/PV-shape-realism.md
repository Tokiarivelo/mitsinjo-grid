# PV-R — 3D realism: a model that looks like the object, not like boxes (plan)

**Why (user, 2026-11-01):** the generated car is a dark-blue box with a pale-grey box on top and four black discs:
« ugly, not conform to the image, no good styling ». PF-T1…T9 (`PV-shape-fidelity.md`) made the numbers right
(colours, roofline, row count, yaw, IoU ≥ 0.9 on the synthetic set), but the **vocabulary** is 5 sharp primitives
under flat lights. Fidelity now needs better shapes, surfaces and light, measured by a loop.
**Status:** ❌ planned. **Decisions (user, 2026-11-01):** Meta models only (Muse Spark / Wonder, Muse Image, SAM 3.1);
never paste the photo on the model, **but small tileable swatches cut from it (≈ 64 px) are allowed** as textures.
**Rules kept:** math pure, seeded, tested; ≤ 5 k triangles per object; whole request ≤ 60 s; shape math ≤ 300 ms.
**Skills:** `/shape-3d` (how to build: files, vocabulary, budgets) · `/shape-loop` (the quality loop below).

## Why the car looks like that (from the code)

| What the user sees                   | Cause                                                                              | Where                               |
| ------------------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------- |
| A brick, not a car                   | `vehicle` template = 2 boxes + cylinders; the SAM side profile only feeds the IoU  | `object-kit.ts` `TEMPLATES.vehicle` |
| Sharp edges, toy look                | Box primitives, no bevel, no rounding, flat normals                                | `object-geometry.ts` `unitPart`     |
| Grey cabin, no windows               | Cabin takes the `secondary` colour; glass is never placed where the photo shows it | templates, `measureKitColors` roles |
| Wheels too small, at fixed positions | `spread(perSide, 0.6)` × size 0.18, not the photo's wheels                         | `TEMPLATES.vehicle`                 |
| Plastic, flat light                  | 4 directional lights, no environment map, no ambient occlusion, no texture detail  | `object-editor-3d.tsx`              |

## Research (2026-11-01, sources in the session report)

- Feed-forward image→3D (TRELLIS.2, Hunyuan3D 2.1, SAM 3D Objects): not on the Meta API → out (user keeps Meta only).
- Multi-view generation + reconstruction (Zero123++, InstantMesh): Muse Image 1.0 edits with reference images
  (`/v1/images/edits`) → side / top views → SAM masks → visual hull. A bet: generated views may be inconsistent.
- LLM CAD code + visual feedback (CAD-Coder, CAD-Designer): Spark is multimodal → render, show it, correct once.
- Part masks by concept: SAM 3.1 `segmentImage(url, concept)` is already wired → wheels, windows, doors, chimneys.
- Rendering: three.js `RoomEnvironment` + PMREM image-based light, ACES, rounded geometry.
- Archi reconstruction workflow (`docs/setup/example-3D-workflow.md`, 2026-11-01): staged pipeline
  Perception → Segmentation → Spatial reasoning (coords, dims, parent-child graph, depth,
  uncertainties) → Generation (parametric volumes) → Validation (camera render vs photo, silhouette
  - reprojection error, iterative correction) → Export. Main rule, kept: the LLM reasons, the
    geometry engine builds, the validation engine verifies, the renderer visualises — never delegate
    the whole reconstruction to one free-form LLM answer (already our kit rule, PV-T9b).

## Target pipeline & skills (archi workflow, 2026-11-01)

Target stages (orchestrator = `runObjectShape`; chat side = copilot `loop.ts`):

1. **Perception** (Spark + SAM): box → outline, kit, part masks. Done (PV-T9…PR-2.5).
2. **Reasoning**: object graph (parent → child: panel → wall, chimney → roof, wheel → body),
   constraints (windows in walls, chimney on roof, parts inside parents), depth/order. Missing:
   PR-2.14 builds it; PR-2.16 deduces hidden sides from it (pre-S4, rule-based).
3. **Generation**: templates + measured bodies + fits → recipe. Done through PR-2.13.
4. **Validation**: flat render vs crop (IoU + edge + ΔE + landmarks PR-0.8), constraint check,
   Spark critic PR-0.6, `make shape-report`. Panel labels every part and key dim **measured /
   estimated / inferred / unknown** — estimates never shown as measured: PR-2.15.
5. **Viewer**: R3F is the output (no Blender, no GLB export — non-goals). VGGT-style research
   models are out (not on the Meta API); Meta models only, per the user decision.

**Scene description** (archi `ArchitecturalScene`): no separate scene file — the kit (what) +
recipe (parts) + graph (relations, PR-2.14) + validation report (constraints, assumptions,
errors) together ARE the interpretable geometric description. The LLM produces kit + graph
params only, never vertices; the deterministic engine builds all geometry.

**Invariants (archi rules):** (1) no incoherent geometry — openings belong to walls and are
really cut (PR-2.17); (2) no invented dimension shown as real — every dim carries its status
(PR-2.15); (3) edits are parametric — `applyEdit` re-solves constraints, never rebuilds
arbitrarily (PR-2.18).

Skills map (archi 12 → ours; agent skills stay procedures, models/engines stay tools):

| Archi skill                      | Here (code or agent skill)                                   | State    |
| -------------------------------- | ------------------------------------------------------------ | -------- |
| image-analysis, object-detection | `shape.ts` prompt, `detect.ts`, `part-masks.ts`              | done     |
| segmentation                     | SAM 3.1 `segmentImage` + `mask-outline.ts` (not SAM 2)       | done     |
| depth-estimation                 | yaw + box proportions only; true depth via S4                | S4 bet   |
| geometry-reconstruction          | `silhouette-fit`, `profile-body`, `lathe-body`, `part-fit`   | done     |
| roof-reconstruction              | `roofline`, `measuredHouse`, PR-2.10 chimney                 | S2       |
| multiview-reasoning              | mirror + imagined re-renders only                            | PR-2.16  |
| procedural-generation            | `kitToRecipe` + `object-geometry.ts` (Three.js, no Blender)  | done     |
| material-generation              | `surface-look`, `surface-maps`, swatches (viewer PBR-ish)    | done     |
| threejs-scene-generation         | `object-editor-3d.tsx` + `/scene-3d`                         | done     |
| gltf-export                      | — (viewer is the output)                                     | non-goal |
| 3d-validation                    | `/shape-loop`, `scoreModel`, PR-0.8 landmarks, PR-0.6 critic | S0       |

## The loop (how every task is judged) — `/shape-loop`

1. `make shape-report` → for each golden object: photo crop | flat render at the photo view | ¾ render, and the scores.
2. Read the table; pick the **worst metric** on the **worst object**; fix one thing (one small task below, or one bug).
3. Re-run. A metric that drops by > 2 points on any object → fix or revert before going on.
4. Every 3 iterations (or after a Look task): `/designer-3d` reviews the ¾ sheet, ≤ 3 issues, score 1–5.
5. Log one row in « Loop log » (bottom). Stop an issue after 3 rounds without gain and ask the user.
   Autonomous: `/loop /shape-loop` (self-paced) until the stop criteria hold.

**Stop criteria (per object of the real set):** silhouette IoU ≥ 0.85 · edge F1 ≥ 0.6 · region ΔE2000 ≤ 8 ·
part counts exact (wheels, windows, gables) · constraints hold (0 violations: parts inside parents,
chimney on roof) · designer score ≥ 4/5 · shape math ≤ 300 ms · request ≤ 45 s.

## Tasks (small: ≤ ½ day each, one commit each)

### S0 — Measure first (the loop needs it)

- [x] **PR-0.1 Flat renderer.** Pure TS z-buffer raster of a recipe at the photo view (orthographic + yaw, Lambert
      shade, per-part colour), reusing `silhouette-fit` hulls → `Mask` + RGB buffer. Test: a box renders its colour.
- [x] **PR-0.2 Score.** `scoreModel(render, crop, outline)` → `{ iou, edgeF1, deltaE (masked mean), score 0–100 }`.
      Test on the golden set; the car must score lower than the fridge today. Done: `model-score.ts` (silhouette
      edges count on both sides, Canny-thinned photo edges), `score-shape.ts` `scoreRecipe(photo, target, recipe)`.
- [x] **PR-0.3 Report.** `make shape-report`: golden set → `test-results/shape-report/index.md` (table) + one PNG
      contact sheet (sharp composite). Gitignored output.
- [ ] **PR-0.4 Capture.** `make shape-capture PHOTO=… ID=…`: one live run that saves crop, SAM outline, Spark kit and
      part masks as JSON fixtures, so the loop replays offline (no API cost per iteration).
      Machinery done 2026-11-01 (`shape-capture.ts`: kit hook, crop remap, write/read/offline rescore, all tested;
      fixtures in gitignored `__fixtures__/shape/real/`): no live fixture yet — Meta too slow on 2026-11-01
      (SAM aborts, Spark > 150 s, 5 attempts). Re-run the command when Meta is back, then tick this box.
- [ ] **PR-0.6 Spark critic** (user, 2026-11-01: the Meta model must help the render match the selected box).
      Crop | `renderFlat` PNG side by side + kit + scores → Spark → kit JSON patch → re-fit, keep if `scoreModel`
      rises. Live: 1 round when score < 70 and ≥ 20 s left; offline on captures: ≤ 3 rounds. Mock: no patch.
      Guide: `/shape-3d` « Meta in the render loop ». Replaces PR-3.5.
- [ ] **PR-0.5 Real set.** 10 user photos (car, motorbike, cottage row, hut, lamp post, fridge, TV, pump, tree, tank)
      captured with PR-0.4 into `__fixtures__/shape/real/` (gitignored if not shareable; the report skips missing ones).
- [x] **PR-0.7 6-angle preview + validation** (user, 2026-11-01: see the imagined 2D angles before the 3D).
      `POST /api/vision/views` renders the archetype template (measured colours, box proportions, no Spark
      call) at the 6 canonical angles; the panel shows them in a carousel and « Validate & Generate 3D »
      runs the full shape; once built, tabs switch between the model and the 6 views (`shape.imaginedViews`).
      Done: `views-generation.ts`, `views/route.ts`, `object-views-carousel.tsx`, `requestViews`, panel tabs.
- [x] **PR-0.8 Landmark term** (archi loss `L = a·silhouette + b·edges + c·landmarks + d·geometry`).
      When part masks exist: mean distance of rendered part centres (wheels, windows, doors) to their
      mask centres, as a fourth `scoreModel` term with rebalanced `SCORE_WEIGHTS`. Goldens stay neutral
      (no masks offline); live-car e2e must not drop. Test: shifted wheel scores lower.
      Done: `Landmark` (part index + mask centre in grid px), `scoreLandmarks` (mean centroid miss,
      0 at ¼ grid width, hidden/unknown skipped), `SCORE_WEIGHTS_LANDMARKS` (0.35/0.3/0.2/0.15);
      `buildLandmarks` (nearest wheel/thin-box part) + `scoreRecipe` masks param; live rescore and
      panels e2e pass masks (landmark 0.95, score 90 → 91). Capture replay stays 3-term (mapping).
      Goldens identical (classic weights, no `landmark` key).

### S1 — Look (every object at once)

- [x] **PR-1.1 Studio light.** `RoomEnvironment` → PMREM `scene.environment` (256², built once), ACES, one soft key +
      contact shadow; drop 2 of the 4 directional lights. Screenshot before / after. Done: Neutral tone mapping
      (not ACES: keeps the measured colours), vertex colours were converted to linear twice (fixed); shots
      `make shape-shots` (stubbed API, dark + light).
- [x] **PR-1.2 Rounded box.** `box` parts become rounded boxes (radius by material: metal 0.04, plastic 0.03,
      stone 0.01), smooth corner normals. Triangle budget test. Done: `roundedBox` (built at size, r ≤ ¼ thinnest
      side, < 0.005 → plain box), `SURFACE_LOOK[*].radius`; 300 triangles per box, 12 boxes ≤ 5 k.
- [x] **PR-1.3 Bevelled prism + smooth round parts.** Gable prisms with a small eave overhang; spheres / cylinders
      smooth-shaded. Done: `ROOF_OVERHANG` 0.03 on every side (no bevel: roof planes stay flat); round parts
      were already smooth (test added); spheres 18 × 12 so 12 round parts ≤ 5 k triangles.
- [x] **PR-1.4 Procedural maps.** Per material a 128² canvas normal + roughness map (stone blocks, brick courses,
      wood grain, thatch, slate rows, brushed metal, tread), tiled by part size, tinted by the measured colour.
      Done: `surface-maps.ts` (seeded tileable patterns → normal / roughness / grey shade, `planarUvs` in object
      units, `MAP_TILE` 0.25), `surface-textures.ts` (lazy, cached); glass / water / plastic / painted smooth.
- [x] **PR-1.5 Photo swatches.** Server: per textured material, the 64 px patch inside its region with the most even
      texture (lowest gradient-variance outlier, no edges), made tileable (mirror + edge blend), sent as
      `recipe.swatches[material]` (data URL ≤ 8 kB). Overrides PR-1.4's colour map; normals stay procedural. Allowed by the user.
      Done: `photo-swatches.ts` (`blendHalfOffset`, `normaliseSwatch`, `findBestPatch`, `extractSwatches`), `object-editor-3d.tsx`
      `swatchTexture`, brightness gain compensation for PR-1.4 shade map and PR-1.5 swatches.
- [x] **PR-1.6 Loop pass** (`/shape-loop` + `/designer-3d`).
      All golden objects meet the stop criteria: mean score 89, mean IoU 0.96, mean edge F1 0.83, mean ΔE 3.5.
      Car score 90 (edge F1 0.90, IoU 0.94), tree score 88 (edge F1 0.72). Shape math ≤ 195 ms (budget 300 ms).

### S2 — Shape from the photo

- [x] **PR-2.1 `extrude` primitive.** Polygon (box fractions, ≤ 64 points, simplified Douglas–Peucker) → slab with
      bevel. Pure builder + raster support in `silhouette-fit`.
      Done: `points` ring in unit space (schema: required iff extrude, server-built only), `unitExtrude`
      (bevelled, ≤ 64 pts < 1 k tris), hull points in `unitPoints`, ray-polygon even-odd clip in `flat-render`
      (non-convex safe, winding independent). Scores unchanged (no template uses it yet).
- [x] **PR-2.2 Profile body.** Side-seen archetypes (vehicle, cabinet, machine) → main body = SAM outline extruded to
      the kit depth (minus wheels band for vehicles). IoU ≈ SAM IoU by construction.
      Done: `withProfileBody` (outline ring → extrude at the ring bbox, plates notch it to the old box
      top so details keep their visibility, each wheel notches its own well, yaw pre-squeeze in world
      units, fit.iou re-scored). Car 92 → 93 (IoU 0.97, edge 0.92, ΔE 3.2); fridge unchanged at 97.
- [x] **PR-2.3 `lathe` primitive.** Profile (radius per height) → solid of revolution, ≤ 24 segments.
      Done: `profile` ([r, y], 2–32 pts, non-decreasing y, schema iff), `unitLathe` (16 radial segs),
      hull rings in `unitPoints`, frustum-stack ray clip in `flat-render` (tube==cylinder and
      cone-profile==cone pixel for pixel). Tank body + lamp head use static profiles. Lamp 86 → 87
      (IoU 0.95, edge 0.91); lamp ΔE steady at 7.3 (glass measures #f2d78a vs truth #f2d68a — the
      ΔE sits in thin-pole pixels, not the glass).
- [x] **PR-2.4 Lathe body.** Round archetypes (tree crown, lamp head, tank, bush, person) → profile = outline
      half-width per row.
      Done: `withLatheBody` — 24 scanline rows in the main-part band (furthest extent from the
      outline centre, poles close both ends), part resized round (depth = width), same-look
      filler inside dropped (tree canopy spheres). Tree 89 → 99 (IoU 0.99, edge 0.99); lamp
      87 → 89 (IoU 0.97, edge 0.93, ΔE 7.3 → 7.4 on re-sampled head pixels); mean 90 → 93.
      Fixed mid-loop: the 26-row render blew the 300 ms budget (tree 390 ms) → `clipLathe`
      hot loop allocation-free (inline slab scalars, reused span, winner-only normal) plus
      sort-free quadric roots; render 132 → 32 ms, pixel tests unchanged, tree 251 ms.
- [x] **PR-2.5 Part masks.** Server: `segmentImage(crop, concept)` for the archetype's concepts in parallel
      (vehicle: wheel, window; house: window, door, chimney; lamp_post: lamp), ≤ 5 s total, failures ignored.
      Done: `fetchPartMasks` — shared-deadline batch (stragglers dropped, never throws), meta-only
      (mock boxes belong to another image), pixel boxes → crop fractions via `samBoxToNorm`, ≤ 8 per
      concept by confidence. Wired after the kit settles (skipped without photo / segmenting client),
      logged (`3D masks for …: wheel×2, window×4`) and attached as `ObjectShape.partMasks`.
- [x] **PR-2.6 Wheels from masks.** Centre + radius per wheel mask (circle fit), tyre + rim parts; count = masks.
      Done: `withMaskWheels` — Kasa circle fit on the mask outline in photo pixels (box fallback when
      ragged, ≤ 3 masks), crop → box → object mapping via `cropRectForShape`, yaw un-projection ≤ 0.3
      rad. Tyre (template rubber) + alloy rim (camera side) per mask, mirrored far side (single set at
      z ≈ 0 for motorbikes); template wheels replaced so count = masks; 12-part budget drops smallest
      decals first (headlights on the sedan), never the body. Golden car e2e: IoU 0.97 → 0.97, 12 → 12
      parts. Golden set score-neutral (no segmenting client there).
- [x] **PR-2.7 Windows / doors from masks.** Rectangles (min-area box per mask) → inset glass / door panels at
      their place; replaces `spread()`.
      Done: `withMaskPanels` — min-area rect (rotating calipers) per window/door mask, tilt ≤ 20°,
      colours captured from the replaced parts (vehicle shell lends its glass, house doors the tall
      cluster / gable). Vehicle cabin shell recolored body behind measured glass (mirrored); house
      spread facade replaced front-only. Panels clamp into the face span, never float; both sides
      while fundable decals cover both else near-only else prefix; wheels/roof protected. Chimney
      masks fetched but not consumed (needs a stack part — PR-2.9 candidate). Shared `mask-geometry`
      (mapping, `enforcePartBudget`, `isWheelPart`; mask-wheels refactored onto it, tests green).
      Live-car e2e IoU 0.97 → 0.97, 12 → 12 parts; goldens identical (no masks offline).
- [x] **PR-2.8 Region colours.** Each part coloured from its own mask's pixels (glass from windows, tyre from
      wheels, body from the rest).
      Done: `measureRegionColors` — 96² box grid, cells to first containing mask (outline-tested,
      box-only eroded 20% for wheel corners) or the rest pool (outline cells outside masks; skipped
      without outline). `withRegionColors` — thin panels ← window/door regions, biggest wheel per
      site ← tyre region (rims keep alloy), front + unified shell ← rest; linear-space median per
      region, mixed by pixel confidence (untrusted below 64 px). No rescore (colours don't move
      IoU). Lamp/rims stay role colours (no suitable mask/part split yet). Live-car e2e: glass +
      body remeasured, IoU 0.97 → 0.97; goldens identical (no masks offline).
- [x] **PR-2.9 Fit v2.** Per-part parameters (wheel radius, cabin box, eave) by coordinate descent on `scoreModel`,
      multi-start Nelder–Mead (3 seeded starts), still ≤ 300 ms.
      Done: `part-fit.ts` — one pass over the archetype's groups (vehicle: wheels 1D + cabin 2D;
      house: eave 1D), 3 seeded starts × 8 evals on the raw score at a 48-col grid with cached
      photo terms (`photoTerms` + `scoreRender`, `scoreModel` identical), kept iff +0.05. Others:
      no groups, no cost. Live-car e2e: wheels +0.9, cabin +0.5 (coarse pts), fine score steady 93.
- [x] **PR-2.10 Chimney from masks** (investigation rank 1). PR-2.5 fetches the chimney concept but nothing
      places it (template chimney is a static boolean at fixed x = 0.3). Min-area rect per chimney mask →
      stack box on the roof at the mask's x (house only, eave to eave + height, tilt/limits like panels),
      funded by the part-budget backstop. Test: mask → stack on the roof plane; goldens unchanged (no
      chimney there), live e2e IoU stable, math ≤ 300 ms.
      Done: `withMaskChimney` — min-area rect per chimney mask (tilt ≤ 20°, yaw ≤ 0.3, ≤ 2
      masks), feet buried at the eave, top follows the mask (at least peeking above the ridge),
      off-house masks skipped, template stack replaced, decals fund the room. Golden cottage e2e:
      IoU 0.98 → 0.96 (no chimney in the golden outline: above-ridge pixels are false positives
      by construction), parts 9 → 10. Goldens identical; mean 93.
- [x] **PR-2.11 Asymmetric vehicle rears** (investigation rank 2). Templates put headlights at +x only, so
      backs read as front copies (grep: no taillight in `object-kit.ts`). Red lens cylinders at −x plus a
      distinct rear bumper/trunk per vehicle subtype (sedan, van, pickup, motorbike: none), funded by the
      budget backstop (structure protected). Test: rear parts per subtype; ¾ sheet shows red rears; no
      golden metric down > 2.
      Done: `TAIL_LIGHT_COLOR` fixed signal red (kitToRecipe passes non-token colours through);
      sedan −2 coplanar invisible bumpers +2 red lenses (trunk slope kept), van −front bumper
      (rear bumper kept), pickup −front bumper (bed kept), bike none; all ≤ 12, 6-wheel van drops
      lenses before wheels. Mask funding tests updated (lights fund panels/wheels). Goldens
      identical (car 93); rear renders show the lenses (136 px straight, 37 px ¾).
- [x] **PR-2.12 House backs + yaw gates** (investigation rank 3). Measured house panels are front-only: mirror
      them to the back like vehicle glass when the budget allows. Unify the yaw gates (profile 0.26,
      mirror 0.3) into one shared constant with defined 17–60° behaviour (panels near-only, no mirror,
      template kept). Test: yawed-house fixture renders backs; gates documented in a code comment.
      Done: `MASK_YAW_MAX = 0.3` + `MASK_YAW_HARD_MAX = 1.05` in `mask-geometry.ts` (ladder in a
      comment); profile/wheels/chimney on the shared gate (profile 0.26 → 0.3); panels ≤ 17° mirror
      both archetypes, 17–60° near-only, past 60° template. House e2e counts updated (backs).
      Goldens identical.
- [x] **PR-2.13 Loop pass** (covers PR-2.10…2.12).
      Done 2026-11-01: report re-run — every object meets the stop criteria (mean 93, IoU 0.98,
      edge 0.91, ΔE 3.4, math ≤ 267 ms); no metric regressed across the three PRs; no designer
      review (no Look task). Lowest score cottage row (86), all ✓.
- [x] **PR-2.14 Object graph + constraints** (archi reasoning). Parent → child graph per recipe
      (panel → wall, chimney → roof, wheel → body, gable → wall) built once after the masks; a
      constraint pass after every reshape (panels/wheels/fit): parts clamped into their parent span,
      chimney feet on a roof plane, no incoherent intersections. Generalises the panels clamp.
      Each node param carries a dimension status (measured / estimated / inferred / unknown).
      Test: floating panel pulled into the wall; violation count in the report; no golden −2.
      Done: `object-graph.ts` — `buildGraph` (parents + 4 statuses: mask-matched/outline bodies
      measured, far twins inferred, template estimated/unknown by evidence), `applyConstraints`
      (panel clamp into parent span, stack feet onto roofTop, same-ref when clean),
      `checkConstraints` (count); wired after wheels/panels/chimney/fit with rescore on fix;
      report gains a Viol column (0 everywhere). `roofTopAbove` shared with mask-chimney.
      Goldens identical. Also: region-colour rings now use the fetched outline (fix-2 gap).
- [ ] **PR-2.15 Dimension status** (archi rule 2). Every part and key dim (eave, depth, yaw, scale)
      carries measured / estimated / inferred / unknown (unified vocabulary; estimates never shown
      as measured). Stored on the recipe, shown in the panel next to each part and dim (extends the
      AI-vs-computed distinction), counted in the report. Test: golden car wheels measured-with-masks
      / inferred-without, depth estimated; i18n keys + parity.
- [ ] **PR-2.16 Hidden-side deduction** (archi multiview, pre-S4, rule-based). From the graph + yaw +
      archetype symmetry rules, derive the hidden-side part list (rear door opposite front door,
      back windows, roof far slope) as **inferred** parts (feeds PR-2.15), without generative views.
      Gated like mirrors (low yaw only). Test: sedan gains an inferred rear door; backs stop being
      empty on the ¾ sheet; budget held.
  - [ ] **PR-2.17 Real openings** (archi rule 1). Windows/doors stop being decal boxes ON walls:
        walls with observed openings are segmented around each hole (strips between/above/below, no
        CSG dependency), glass inset in the hole; template-only walls keep decals. Openings belong to
        their wall node (PR-2.14 graph). Budget via the backstop (decals fund segments, structure
        protected). Test: wall rect tiled minus openings; inset glass, no overlay z-fight; no golden −2.
- [ ] **PR-2.18 Parametric edits** (archi rule 3). Engine API `applyEdit(graph, { node, param, value })`:
      resize/move an opening, chimney or part → constraints re-solve (PR-2.14), recipe rebuilt
      deterministically, never arbitrarily. Metric values via the estimated scale (status estimated).
      UI/copilot wiring explicitly out. Test: enlarge window 20 % → glass + hole grow, wall bounds
      kept, 0 violations.
      (PR-2.14…2.18 each follow the loop: measure → log a row; the next loop pass covers them.)
- [x] **PR-2.19 Cap box-only colour confidence** (green-Mini fix 1, inserted 2026-11-01).
      Without an outline every box pixel counts, and pixel-count confidence hit 1.0, so hedge
      pixels fully overwrote Spark's car colour. `confidence.colors` takes `hasOutline`: box-only
      mixes cap at 0.3 (Spark leads, measurement nudges). Test: fusion cap + box-only e2e keeps
      mostly the guess.
      Done: `BOX_COLOR_CONFIDENCE_MAX = 0.3`, call site passes `!!outline`; region mixes keep
      the full curve (masks are trusted). Goldens identical (all outlined).
- [x] **PR-2.20 Segment on demand at shape time** (green-Mini fix 2, inserted 2026-11-01).
      Outline-less targets (drawn boxes, > 8 concepts, SAM skipped) get one SAM call on the full
      photo with the normalized concept while Spark thinks; best IoU ≥ 0.3 match lends its outline
      (box always kept), focusing sampling + profile + fit + swatches. Test: unit (match / no
      match / mock / throw) + e2e (fetched outline → stone walls + fit).
      Done: `fetchOutlineForBox` in `outline.ts`, launched before Spark, sampling awaits it
      (usually free). Part-mask call test updated (leading concept call).
- [x] **PR-2.21 Normalize SAM concepts** (green-Mini fix 3, inserted 2026-11-01).
      `conceptOf` sent raw labels ("mini vintage") to SAM. Now: first known object noun wins
      (EN + FR, phrases first, guarded plurals), else the raw label. `Pick<…, 'label'>` so shape
      targets reuse it. Test: wordings → nouns, guard cases, grouping by normalized concept.
      Done: `CONCEPT_NOUNS` table in `outline.ts`. Existing refine tests unaffected.

### S3 — Smarter Spark (model optimisation)

- [ ] **PR-3.1 Eval harness.** `make eval-shape`: replays the captured crops on live Spark, scores archetype /
      sub-type / counts / materials vs truth, latency. Costs API calls: run on demand.
- [x] **PR-3.2 Sub-types.** Kit `subtype`: vehicle sedan · hatchback · vintage · pickup · van · bus · motorbike · cart; house gable · hip ·
      round thatch hut · terrace; tree round · conifer · palm. One template per sub-type.
- [x] **PR-3.3 Prompt v2.** 3D mental interpolation & occlusion reconstruction prompt, vehicle anatomy (hood, windshield, cabin, trunk, 4 wheels, bumpers, lights), recognition boost (aliases, hints).
- [ ] **PR-3.4 Model choice.** muse-spark-1.3 vs muse-wonder-1.0 vs muse-spark-1.2 on accuracy and latency; keep the
      best under 30 s median.
- [x] **PR-3.5 Feedback round.** Moved to PR-0.6 (Spark critic).
- [ ] **PR-3.6 Loop pass.**

### S4 — Generated views (bet, behind `SHAPE_VIEWS=1`)

- [ ] **PR-4.1 Spike (1 h).** Muse Image `/v1/images/edits` on 5 crops: « same object, orthographic side view, white
      background » and top view. Record latency, cost, consistency. Stop S4 if > 20 s or inconsistent.
- [ ] **PR-4.2 View masks.** SAM on each generated view; scale views to the photo height.
- [ ] **PR-4.3 Voxel hull.** 64³ carving from front + side + top masks. Test on synthetic cube / cylinder / car.
- [ ] **PR-4.4 Mesh.** Marching cubes → Taubin smoothing → decimation ≤ 5 k triangles; region colours per vertex
      from the nearest view (swatches allowed).
- [ ] **PR-4.5 Best candidate.** Template, profile body or hull: keep the best `scoreModel`; panel says which.
- [ ] **PR-4.6 Loop pass.**

### Close

- [ ] **PR-5.1 Docs** (absorbs PF-T10): contracts (primitives, `texture`, part masks, `subtype`, views flag, graph, part status, openings, edits), copilot
      (prompt v2, model choice), performance (render + math budgets).
- [ ] **PR-5.2 Scenarios** in `test-scenarios/06-village.md` for each visible step (car, hut, tree, mock unchanged).

## Order

S0 first (½–1 day): without the score the loop is guesswork. Then S1 (biggest visible change for every object),
S2 (shape), S3 (Spark), S4 last (a bet). Archi-workflow additions slot in: PR-0.8 with S0, PR-2.14…2.18
after PR-2.13 in rank order (graph → status → hidden sides → openings → edits), each judged by the loop.
Expect the car to stop looking like a brick after PR-1.1…1.3 + PR-2.2 + PR-2.6.

## Loop log

| Date       | Task / fix                                                             | Mean IoU | Edge F1 | Mean ΔE | Designer | Note                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------- | -------- | ------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-01 | PR-0.2 baseline (synthetic golden set)                                 | 0.95     | 0.76    | 3.6     | —        | scores: cottage 86 · lamp 86 · fridge 97 · car 83 · tree 80; worst = tree edge F1 0.54                                                                 |
| 2026-11-01 | PR-0.3 report; renderer fix: flush parts z-fought (comb on car wheels) | 0.95     | 0.76    | 3.7     | —        | car 83 → 82 (wheels now drawn whole, misfit visible); next: tree edge F1 0.54                                                                          |
| 2026-11-01 | PR-1.1 studio light + vertex colour fix (viewer only)                  | 0.95     | 0.76    | 3.7     | —        | flat-render scores unchanged (viewer-only change); viewer colours now match the measured ones (before: darker, saturated)                              |
| 2026-11-01 | PR-1.2 rounded boxes (viewer only)                                     | 0.95     | 0.76    | 3.7     | —        | scores unchanged (score renderer keeps sharp boxes); edges catch the studio light                                                                      |
| 2026-11-01 | PR-1.3 roof overhang, sphere budget (viewer only)                      | 0.95     | 0.76    | 3.7     | —        | scores unchanged; cottage roofs read as roofs                                                                                                          |
| 2026-11-01 | PR-1.4 procedural maps; golden priors name materials                   | 0.95     | 0.76    | 3.7     | —        | scores unchanged; issue for the loop: metal parts (metalness 0.6) render darker than the measured colour                                               |
| 2026-11-01 | PR-1.5 photo swatches; shade map brightness gain compensation          | 0.95     | 0.76    | 3.7     | —        | scores unchanged; textured surfaces no longer darken by 20%; tileable swatches cut per material                                                        |
| 2026-11-01 | PR-3.2/3.3 Vehicle subtypes + 3D imagination & interpolation boost     | 0.95     | 0.79    | 3.8     | —        | car score 82 → 85, car edge F1 0.72 → 0.84 (12 parts: sloped windshield/rear, separate L/R wheels, bumpers, headlights)                                |
| 2026-11-01 | PR-1.6 Loop pass: tree crown y=0.16 + car alignment + user car test    | 0.96     | 0.83    | 3.5     | 4/5      | all objects meet criteria! car score 85 → 90 (edge F1 0.90), tree 80 → 88 (edge F1 0.72), mean score 89; triangles ≤ 5k, math ≤ 195 ms                 |
| 2026-11-01 | Vehicle glass roles + metal bumpers + anti-brick archetype fallback    | 0.96     | 0.83    | 3.3     | 5/5      | car ΔE 3.8 → 2.5, car score 90 → 92, mean score 90; windshield & headlights glass, bumpers metal; anti-brick fallback on unsegmented box               |
| 2026-11-01 | PR-0.7 6-angle preview + tree multi-tier canopy (5 spheres)            | 0.96     | 0.84    | 3.3     | —        | tree 88 → 89 (edge F1 0.75), car steady 92, mean 90; no regression; views are score-neutral (rendered from the recipe)                                 |
| 2026-11-01 | PR-2.1 `extrude` primitive (ring + bevel + ray clip)                   | 0.96     | 0.84    | 3.3     | —        | scores identical (unused by templates yet); L-notch renders 768 px, square == box mask, 64-gon < 1 k tris                                              |
| 2026-11-01 | PR-2.2 profile body (outline extrude + wells + notches)                | 0.97     | 0.84    | 3.4     | —        | car 92 → 93 (IoU 0.97, edge 0.92, ΔE 3.2); fridge steady 97; fixed mid-loop: global band cut → per-wheel wells, yaw squeeze in world units             |
| 2026-11-01 | PR-2.3 `lathe` primitive (profile + frustum ray clip)                  | 0.97     | 0.85    | 3.4     | —        | lamp 86 → 87 (IoU 0.95, edge 0.91, ΔE steady 7.3); tank unmeasured (not golden); fixed mid-loop: flat annuli, cap normals, eased (not round) lamp bowl |
| 2026-11-01 | PR-2.4 lathe body (outline half-width rows + render fix)               | 0.98     | 0.91    | 3.4     | —        | tree 89 → 99 (IoU 0.99, edge 0.99), lamp 87 → 89 (ΔE 7.3 → 7.4); hot-loop rewrite after budget blow (render 132 → 32 ms, pixels identical)             |
| 2026-11-01 | PR-2.5 part masks (concept batch + attach)                             | 0.98     | 0.91    | 3.4     | —        | scores identical (no consumer yet — PR-2.6…2.8); 6 unit + 1 pipeline test, contract entry                                                              |
| 2026-11-01 | PR-2.6 wheels from masks (Kasa fit + mirror + budget)                  | 0.98     | 0.91    | 3.4     | —        | goldens identical (no masks offline); live-car e2e IoU 0.97 → 0.97, parts 12 → 12 (headlights fund the rims)                                           |
| 2026-11-01 | PR-2.7 panels from masks (calipers + shell + room)                     | 0.98     | 0.91    | 3.4     | —        | goldens identical (no masks offline); live-car e2e IoU 0.97 → 0.97; fixed mid-PR: wheels/roof protected, sides decided before dropping                 |
| 2026-11-01 | PR-2.8 region colours (median per mask + rest)                         | 0.98     | 0.91    | 3.4     | —        | goldens identical (no masks offline); live-car e2e stable; fixed mid-PR: median not mean (rest-mean went mauve #a0545c, median reads pure #b0302f)     |
| 2026-11-01 | PR-2.9 Fit v2 (coordinate descent on the raw score)                    | 0.98     | 0.91    | 3.4     | —        | car 93 → 93 (edge +0.01, IoU −0.01; coarse +1.4); cottage eave no gain; car math 174 → 257 ms; panels e2e fixed                                        |
| 2026-11-01 | PR-2.10 chimney from masks (min-area rect → stack on the roof)         | 0.98     | 0.91    | 3.4     | —        | goldens identical (no masks offline); cottage e2e IoU 0.98 → 0.96, parts 9 → 10; fixed mid-PR: e2e mask shrunk (golden outline has no chimney)         |
| 2026-11-01 | PR-2.11 asymmetric vehicle rears (red lenses + rear bumper/trunk)      | 0.98     | 0.91    | 3.4     | —        | goldens identical (bumpers were coplanar-invisible); masks funding tests re-pointed at the lights; probe: rear 136 px, ¾ 37 px red (deleted after)     |
| 2026-11-01 | PR-2.19 box-only colour cap (0.3, guess leads)                         | 0.98     | 0.91    | 3.4     | —        | goldens identical (all outlined); box-only e2e keeps mostly the guess; fixed mid-PR: linear-space closeness (sRGB gamma fooled the first assertion)    |
| 2026-11-01 | PR-2.21 SAM concept normalization (noun table)                         | 0.98     | 0.91    | 3.4     | —        | goldens identical; refine + grouping tests green; fixed mid-PR: guarded regexes (street→tree, power plant→bush, bare mini dropped)                     |
| 2026-11-01 | PR-2.20 on-demand outline at shape time                                | 0.98     | 0.91    | 3.4     | —        | goldens identical (all outlined); e2e fetched outline → stone walls + fit; region concept test re-pointed (water pump → pump                           |
| 2026-11-01 | PR-2.12 house backs + shared yaw gates (0.3 / 1.05)                    | 0.98     | 0.91    | 3.4     | —        | goldens identical (no masks offline); house e2e 6 → 8 parts (backs); profile gate 0.26 → 0.3, no golden in the sliver                                  |
| 2026-11-01 | PR-0.8 landmark term (part centres vs mask centres)                    | 0.98     | 0.91    | 3.4     | —        | goldens identical (classic weights); live-car e2e landmark 0.95, score 90 → 91; shifted wheel scores lower; capture replay left 3-term                 |
| 2026-11-01 | PR-2.14 object graph + constraints + Viol column                       | 0.98     | 0.91    | 3.4     | —        | goldens identical, Viol 0 everywhere; floating panel/stack pulled in (unit); fixed mid-PR: tuple types, lint _dropped warnings                         |
