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

## The loop (how every task is judged) — `/shape-loop`

1. `make shape-report` → for each golden object: photo crop | flat render at the photo view | ¾ render, and the scores.
2. Read the table; pick the **worst metric** on the **worst object**; fix one thing (one small task below, or one bug).
3. Re-run. A metric that drops by > 2 points on any object → fix or revert before going on.
4. Every 3 iterations (or after a Look task): `/designer-3d` reviews the ¾ sheet, ≤ 3 issues, score 1–5.
5. Log one row in « Loop log » (bottom). Stop an issue after 3 rounds without gain and ask the user.
   Autonomous: `/loop /shape-loop` (self-paced) until the stop criteria hold.

**Stop criteria (per object of the real set):** silhouette IoU ≥ 0.85 · edge F1 ≥ 0.6 · region ΔE2000 ≤ 8 ·
part counts exact (wheels, windows, gables) · designer score ≥ 4/5 · shape math ≤ 300 ms · request ≤ 45 s.

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
- [ ] **PR-2.8 Region colours.** Each part coloured from its own mask's pixels (glass from windows, tyre from
      wheels, body from the rest).
- [ ] **PR-2.9 Fit v2.** Per-part parameters (wheel radius, cabin box, eave) by coordinate descent on `scoreModel`,
      multi-start Nelder–Mead (3 seeded starts), still ≤ 300 ms.
- [ ] **PR-2.10 Loop pass.**

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

- [ ] **PR-5.1 Docs** (absorbs PF-T10): contracts (primitives, `texture`, part masks, `subtype`, views flag), copilot
      (prompt v2, model choice), performance (render + math budgets).
- [ ] **PR-5.2 Scenarios** in `test-scenarios/06-village.md` for each visible step (car, hut, tree, mock unchanged).

## Order

S0 first (½–1 day): without the score the loop is guesswork. Then S1 (biggest visible change for every object),
S2 (shape), S3 (Spark), S4 last (a bet). Expect the car to stop looking like a brick after PR-1.1…1.3 + PR-2.2 + PR-2.6.

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
