# PV-R — 3D realism: a model that looks like the object, not like boxes (plan)

**Why (user, 2026-11-01):** the generated car is a dark-blue box with a pale-grey box on top and four black discs:
« ugly, not conform to the image, no good styling ». PF-T1…T9 (`PV-shape-fidelity.md`) made the numbers right
(colours, roofline, row count, yaw, IoU 0.9 on the golden set), but the **vocabulary** is still 5 primitives with sharp
edges under flat lights. Fidelity now needs better shapes, better surfaces and better light, not better measurements.
**Status:** ❌ planned. **Rules kept:** Meta models only (Muse Spark, Muse Image, SAM 3.1); never paste the photo
on the model (user, 2026-11-01); math pure, seeded, tested; ≤ 5 k triangles per object; 60 s total budget.

## Why the car looks like that (from the code)

| What the user sees                   | Cause                                                                                   | Where                               |
| ------------------------------------ | --------------------------------------------------------------------------------------- | ----------------------------------- |
| A brick, not a car                   | `vehicle` template = 2 boxes + cylinders; the SAM side profile is only used for the IoU | `object-kit.ts` `TEMPLATES.vehicle` |
| Sharp edges, toy look                | Box primitives, no bevel, no rounding, flat normals                                     | `object-geometry.ts` `unitPart`     |
| Grey cabin, no windows               | Cabin takes the `secondary` colour; glass is never placed where the photo shows it      | templates, `measureKitColors` roles |
| Wheels too small, at fixed positions | `spread(perSide, 0.6)` × size 0.18, not the photo's wheels                              | `TEMPLATES.vehicle`                 |
| Plastic, flat light                  | 4 directional lights, no environment map, no ambient occlusion, no texture detail       | `object-editor-3d.tsx`              |

## What others do (research, 2026-11-01)

- **Feed-forward image→3D** (TRELLIS.2, Hunyuan3D 2.1, SAM 3D Objects): best quality, but not on the Meta API
  (PF-T8) → excluded by the Meta-only rule. Only lifting that rule gives « photo-real » meshes in one call.
- **Multi-view generation + reconstruction** (Zero123++, One-2-3-45, InstantMesh): generate side / back views, then
  rebuild. Muse Image 1.0 edits with reference images (`/v1/images/edits`, up to 10 refs, third-party docs) → we can
  ask it for an orthographic side and top view of the object and **carve a visual hull** from the SAM masks.
- **Code / CAD generation by an LLM** (CAD-Coder, CAD-Designer): the model writes a parametric program, a render is
  compared with the image and fed back. Spark can do this with a richer part vocabulary (lathe, extrusion, rounded box).
- **Part masks by concept** (SAM 3 « segment anything with concepts »): already on our API (`segmentImage(url, concept)`)
  → « wheel », « window », « door », « roof » inside the crop give each part's true place and size.
- **Rendering** (three.js `RoomEnvironment` + `PMREMGenerator`, ACES, soft shadow, `RoundedBoxGeometry`): image-based
  light makes the same geometry read as painted metal, glass and stone instead of plastic.

## Plan (each step ships alone, behind the same « Generate 3D » button)

### Tier 1 — Look (1 day, deterministic, no new AI call)

- [ ] **PR-T1 Studio light.** `RoomEnvironment` → PMREM as `scene.environment`, ACES tone mapping, one soft key light
      with a contact shadow; glass and metal finally reflect. Budget: one 256² PMREM, built once per viewer.
- [ ] **PR-T2 Soft geometry.** `box` → rounded box (radius per material: metal 0.04, stone 0.01), smooth normals on
      round parts, bevelled prisms; new primitives `lathe` (profile → solid of revolution: lamp heads, tanks, tree crowns)
      and `extrude` (2-D polygon → slab with bevel). Pure builders in `object-geometry.ts`, tested on vertex counts.
- [ ] **PR-T3 Procedural surfaces.** Per material a small canvas-generated normal + roughness map (stone blocks, brick
      courses, wood grain, thatch strands, slate rows, brushed metal, tyre tread), tinted by the measured colour, scaled
      to the part size. Not the photo: generated patterns (user rule). ≤ 6 textures of 128², cached.

### Tier 2 — Shape from the photo (2 days, deterministic)

- [ ] **PR-T4 Profile body.** For side-seen objects (vehicle, cabinet, machine, building), the main body = the SAM
      outline (simplified, ≤ 64 points) **extruded** to the kit depth with a bevel, instead of a box. Front-seen objects
      (house facade, screen) keep the template. IoU of the body = SAM IoU by construction.
- [ ] **PR-T5 Two-view hull for round objects.** Tree, lamp, tank, person: the outline's half-width per row → `lathe`
      profile (assumes rotational symmetry) — a tree crown gets its real shape, a lamp post its real head.
- [ ] **PR-T6 Part masks by concept (SAM 3.1).** One call per archetype with its part concepts (vehicle: wheel,
      window; house: window, door, chimney; lamp: lamp head) on the crop. Wheels → cylinders at the measured centres and
      radius; windows / doors → inset glass / wood panels at their measured rectangles; chimney → box at its place.
      Replaces `spread()` guesses. Confidence = SAM score (feeds PF-T7 fusion). +1 call (≈ 1–3 s).
- [ ] **PR-T7 Region colours.** Colour each part from the pixels of its own SAM part mask (glass from the window
      mask, tyre from the wheel mask, body from the rest), not from 3 global clusters.

### Tier 3 — Generated views (2–3 days, experimental, behind `SHAPE_VIEWS=1`)

- [ ] **PR-T8 Spike (1 h): Muse Image views.** Check `POST /v1/images/edits` with the crop: « same object, pure side
      view / top view, orthographic, white background ». Record latency, cost, consistency on the 5 golden objects.
      Stop here if views are inconsistent or > 20 s.
- [ ] **PR-T9 Visual hull.** Front (photo) + side + top masks (SAM on each view) → 64³ voxel carving → marching cubes →
      Taubin smoothing → decimate ≤ 5 k triangles; per-vertex colour from the nearest view's region colours (not a photo
      texture). Pure TS, seeded, tested on synthetic silhouettes (cube, cylinder, car profile).
- [ ] **PR-T10 Pick the best.** Render each candidate (template, profile body, hull) at the photo view, keep the one with
      the best `J` (PF-T6); show which one in the panel (« built from 3 views »).

### Tier 4 — Spark writes and corrects (optional, 1 day)

- [ ] **PR-T11 Richer kit vocabulary + one feedback round.** Spark may return `lathe` / `extrude` parts; the server
      renders the silhouette, sends Spark the IoU and the 3 worst-matching regions once, and keeps the better answer.
      Only when time is left in the 60 s budget.

### Measure and close

- [ ] **PR-T12 Real golden set.** 10 real photos the user owns (car, motorbike, cottage row, hut, lamp post, fridge, TV,
      pump, tree, water tank) + hand-drawn masks; metrics: silhouette IoU, region ΔE2000, part counts (wheels, windows),
      and a 4-view screenshot sheet reviewed with `/designer-3d`. `make test-shape` runs the synthetic + real sets.
- [ ] **PR-T13 Docs and scenarios** (absorbs PF-T10): contracts (new primitives, part masks, views flag), copilot (Spark
      vocabulary), performance (render budget), `test-scenarios/06-village.md`.

## Order and expected effect

PR-T1…T3 change how every object looks (the car becomes painted metal with glass and rubber). PR-T4 + PR-T6 change
its shape (real profile, real wheels and windows). That is the recommended first sprint (≈ 3 days). Tier 3 is the
only path toward « any object, real 3D » inside the Meta-only rule; it is a bet, so it starts with a 1-hour spike.

## Open decisions (user)

1. Keep **Meta only**? Lifting it (TRELLIS.2 / Hunyuan3D via a hosted API) is the only one-call route to photo-real
   meshes; it adds a vendor, a key and ≈ 10–30 s per object.
2. Procedural textures (PR-T3) are generated patterns tinted by the measured colour. A **tileable swatch cut from the
   photo** (64 px of real stone) would look more real but is a piece of the photo: allowed or not?
