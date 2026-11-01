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
- [ ] **PR-0.6 Spark critic** (user, 2026-11-01: the Meta model must help the render match the selected box).
      Crop | `renderFlat` PNG side by side + kit + scores → Spark → kit JSON patch → re-fit, keep if `scoreModel`
      rises. Live: 1 round when score < 70 and ≥ 20 s left; offline on captures: ≤ 3 rounds. Mock: no patch.
      Guide: `/shape-3d` « Meta in the render loop ». Replaces PR-3.5.
- [ ] **PR-0.5 Real set.** 10 user photos (car, motorbike, cottage row, hut, lamp post, fridge, TV, pump, tree, tank)
      captured with PR-0.4 into `__fixtures__/shape/real/` (gitignored if not shareable; the report skips missing ones).

### S1 — Look (every object at once)

- [ ] **PR-1.1 Studio light.** `RoomEnvironment` → PMREM `scene.environment` (256², built once), ACES, one soft key +
      contact shadow; drop 2 of the 4 directional lights. Screenshot before / after.
- [ ] **PR-1.2 Rounded box.** `box` parts become rounded boxes (radius by material: metal 0.04, plastic 0.03,
      stone 0.01), smooth corner normals. Triangle budget test.
- [ ] **PR-1.3 Bevelled prism + smooth round parts.** Gable prisms with a small eave overhang; spheres / cylinders
      smooth-shaded.
- [ ] **PR-1.4 Procedural maps.** Per material a 128² canvas normal + roughness map (stone blocks, brick courses,
      wood grain, thatch, slate rows, brushed metal, tread), tiled by part size, tinted by the measured colour.
- [ ] **PR-1.5 Photo swatches.** Server: per textured material, the 64 px patch inside its region with the most even
      texture (lowest gradient-variance outlier, no edges), made tileable (mirror + edge blend), sent as
      `part.texture` (data URL ≤ 8 kB). Overrides PR-1.4's colour map; normals stay procedural. Allowed by the user.
- [ ] **PR-1.6 Loop pass** (`/shape-loop` + `/designer-3d`).

### S2 — Shape from the photo

- [ ] **PR-2.1 `extrude` primitive.** Polygon (box fractions, ≤ 64 points, simplified Douglas–Peucker) → slab with
      bevel. Pure builder + raster support in `silhouette-fit`.
- [ ] **PR-2.2 Profile body.** Side-seen archetypes (vehicle, cabinet, machine) → main body = SAM outline extruded to
      the kit depth (minus wheels band for vehicles). IoU ≈ SAM IoU by construction.
- [ ] **PR-2.3 `lathe` primitive.** Profile (radius per height) → solid of revolution, ≤ 24 segments.
- [ ] **PR-2.4 Lathe body.** Round archetypes (tree crown, lamp head, tank, bush, person) → profile = outline
      half-width per row.
- [ ] **PR-2.5 Part masks.** Server: `segmentImage(crop, concept)` for the archetype's concepts in parallel
      (vehicle: wheel, window; house: window, door, chimney; lamp_post: lamp), ≤ 5 s total, failures ignored.
- [ ] **PR-2.6 Wheels from masks.** Centre + radius per wheel mask (circle fit), tyre + rim parts; count = masks.
- [ ] **PR-2.7 Windows / doors from masks.** Rectangles (min-area box per mask) → inset glass / door panels at
      their place; replaces `spread()`.
- [ ] **PR-2.8 Region colours.** Each part coloured from its own mask's pixels (glass from windows, tyre from
      wheels, body from the rest).
- [ ] **PR-2.9 Fit v2.** Per-part parameters (wheel radius, cabin box, eave) by coordinate descent on `scoreModel`,
      multi-start Nelder–Mead (3 seeded starts), still ≤ 300 ms.
- [ ] **PR-2.10 Loop pass.**

### S3 — Smarter Spark (model optimisation)

- [ ] **PR-3.1 Eval harness.** `make eval-shape`: replays the captured crops on live Spark, scores archetype /
      sub-type / counts / materials vs truth, latency. Costs API calls: run on demand.
- [ ] **PR-3.2 Sub-types.** Kit `subtype`: vehicle sedan · pickup · van · bus · motorbike · cart; house gable · hip ·
      round thatch hut · terrace; tree round · conifer · palm. One template per sub-type.
- [ ] **PR-3.3 Prompt v2.** One-line definition + example per sub-type, materials list, shorter schema; A/B with
      PR-3.1, keep the better.
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

| Date       | Task / fix                                                             | Mean IoU | Edge F1 | Mean ΔE | Designer | Note                                                                                   |
| ---------- | ---------------------------------------------------------------------- | -------- | ------- | ------- | -------- | -------------------------------------------------------------------------------------- |
| 2026-11-01 | PR-0.2 baseline (synthetic golden set)                                 | 0.95     | 0.76    | 3.6     | —        | scores: cottage 86 · lamp 86 · fridge 97 · car 83 · tree 80; worst = tree edge F1 0.54 |
| 2026-11-01 | PR-0.3 report; renderer fix: flush parts z-fought (comb on car wheels) | 0.95     | 0.76    | 3.7     | —        | car 83 → 82 (wheels now drawn whole, misfit visible); next: tree edge F1 0.54          |
