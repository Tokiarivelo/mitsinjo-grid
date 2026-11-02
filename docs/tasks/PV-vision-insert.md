# PV — Vision insert: photo → detected appliances → 3D editor → simulation

**Read first:** `docs/contracts.md`, `docs/engine-spec.md` § 6 (sector load), `docs/copilot.md`, this file.

Goal (demo): drop a photo in the copilot chat, see the appliances outlined (hover = highlight), pick one,
inspect and edit it in 3D (by hand or by asking the copilot), then **Insert into simulation**: it appears
in the 3D village and the settings with its name and load, and every strategy comparison accounts for it.

Status: **plan**, nothing implemented. Research done on 2026-10-31 (sources at the end).

## Principles (non-negotiable rules applied)

- **Vision recognizes, the engine computes.** Muse/SAM return only labels, a category and geometry.
  Watts, hours and the 24 h load curve come only from `@mitsinjo/engine` (appliance catalog + pure function).
  The LLM never sends a kW value; manual edits go through the engine schema (bounded by Zod).
- **Few tokens.** One Muse Spark call per photo (structured JSON, not prose). SAM and 3D are billed per
  image/object, not per token. No LLM call for the math.
- **Demo must always work:** `LLM_PROVIDER=mock` returns a fixed detection on a bundled sample photo;
  every remote step has a timeout and a local fallback (box outline instead of mask, stylized 3D model
  instead of the generated mesh).
- Server-only calls in `apps/web/src/server/vision/` (`import 'server-only'`), keys via `src/lib/env.ts`.
- i18n EN/FR/MG, dark/light tokens, mobile first (≥ 44 px targets), `SIMULATED DATA` label, AI text distinct.

## Building blocks (research summary)

| Step              | Model / service                                               | Input → output                                                                                                                                | Cost / limits                                                                                   |
| ----------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Detect + classify | `muse-spark-1.3` (Meta Model API, already used)               | image + JSON schema → `[{label, category, bbox:[x_min,y_min,x_max,y_max]}]`, grid 0–1000, top-left origin; missing objects omitted            | tokens for 1 image + short JSON; values may exceed 1000 → clamp; counting imperfect             |
| Precise outlines  | `sam-3.1` (Meta Model API, `POST /v1/responses`)              | image + one noun phrase (`input_text`) → special-token text `<Nf>id<\|box;x1;y1;x2;y2;w;h[;c]\|><\|mask;…data=H,W,~payload\|>`, source pixels | ≈ $2.50 / 1k images; text prompts only on the API (no box/point prompt); one phrase per request |
| Mask decode       | `@meta-sam/parser` (npm, 0.1.0, Meta)                         | SAM output → typed records, raster / COCO RLE / **SVG path**                                                                                  | SAM License (copy in `licenses/`), added 2026-10-31                                             |
| Photo → 3D        | `muse-spark-1.3` shape recipe (+ SAM 3.1 outline as fallback) | crop → JSON parts recipe (box / cylinder / sphere / cone, colours); poor or failed → SAM outline extruded (no photo on it, 11-01)             | Meta models only (user, 2026-10-31): no photo→3D model on the Meta API; SAM 3D Objects not used |

Open checks before coding (the session network blocked `dev.meta.ai`): exact `sam-3.1` request metadata
(`mask_encoding`, `include_confidence`), max image size, rate limits, `@meta-sam/parser` licence.

## Data contracts (add to `docs/contracts.md` in V1)

- `ApplianceCategory` = closed enum: `fridge`, `freezer`, `tv`, `lamp`, `fan`, `laptop`, `phone_charger`,
  `radio`, `water_pump`, `rice_mill`, `sewing_machine`, `welder`, `fridge_vaccine`, `computer`, `other`.
- `ApplianceSpec` (engine catalog, read-only): `{ category, defaultW, minW, maxW, hourlyDuty: number[24] }`.
- `Appliance` (engine input): `{ id, name (1–40 chars), category, sector: SectorId, watts, quantity (1–50),
hourlyDuty?: number[24] (0–1, default = catalog) }`.
- `SimulationInput.appliances?: Appliance[]` (max 30) and `InputPatch.appliances` (replace list).
- `VisionDetection` (server → client): `{ id, label, category, confidence?, box: {x,y,w,h} (0–1 of image),
outline?: string (SVG path, image-normalized) }`. Never contains power values.
- SSE events: `vision_detections`, `vision_mesh_ready { detectionId, glbUrl }`, `vision_error`.

## Tasks

### V1 — Engine: appliance catalog and load (pure, tested)

- [x] **PV-T1** `packages/engine/src/appliances/catalog.ts`: `APPLIANCE_CATALOG: Record<ApplianceCategory,
ApplianceSpec>` (watts and duty profiles of rural use, sources noted in `engine-spec.md`).
      **Done when** every category has a spec and a test checks bounds and 24 values.
- [x] **PV-T2** `applianceProfileKw(appliance): number[24]` = watts × quantity × duty / 1000; Zod schemas
      `ApplianceSchema`, `InputPatch.appliances`; demand model adds the profiles to their sector.
      **Done when** an input without appliances gives identical results (golden test) and one fridge adds
      exactly its curve to its sector; `ENGINE_VERSION` bumped.
- [x] **PV-T3** Strategies, metrics and warnings see appliance load like any sector load (critical share
      from the sector). **Done when** `compare()` changes as expected on `cloudy_day` with 5 pumps on `water`.

### V2 — Server: detection and outlines

- [x] **PV-T4** `server/perception/detect.ts` (reuses the perception client: fallback, spend cap, contributor id;
      `chat/completions` JSON schema, already recorded from real calls, instead of the Responses API): Muse Spark 1.3, Responses API, image as data URL, structured
      output (JSON schema with the category enum), clamp 0–1000 → 0–1, drop unknown categories to `other`.
      **Done when** unit tests cover parsing, clamping, out-of-enum labels and a malformed reply.
- [x] **PV-T5** `server/perception/outline.ts` + `mask-outline.ts`: one `sam-3.1` call per distinct label (parallel,
      timeout 8 s), match SAM instances to Muse boxes by IoU, decode the mask with `@meta-sam/parser` (SAM License,
      `THIRD_PARTY_NOTICES.md`) → simplified SVG path. **Done when** tests run on recorded SAM responses (README masks);
      on timeout the box outline is kept.
- [x] **PV-T6** Route `app/api/vision/route.ts` (POST image ≤ 4 MB, resized client-side to ≤ 1280 px)
      streaming `vision_detections`; mock provider returns the fixture for `public/samples/vision-room.jpg`.
      **Done when** `make dev-mock` shows detections offline. _(Route test runs the handler offline; the sample is a drawn
      room, source `scripts/assets/vision-room.svg`, boxes = `MOCK_DETECTIONS`. On screen in V3.)_

### V3 — Web: detection editor in the chat

- [x] **PV-T7** `features/vision-insert/ui/detection-canvas.tsx`: image + SVG overlay (outline per object,
      hover/focus = highlight + label chip, click/Enter = select), keyboard and touch accessible,
      responsive (pinch-free, fits 320 px). Opened when an image is attached in the copilot.
      _(Opened from the attached-image chip, « Find appliances », not automatically: each run is a paid vision call.)_
      **Done when** component tests cover hover, select, empty result, error state.
- [x] **PV-T7b** Own menu entry: `/village` « Village editor » (sidebar + MobileNav) with photo picker, sample room,
      detection canvas and selected-appliance aside; the chat image chip keeps the dialog as a shortcut. V4 builds on this page.
      _(Also: live village preview on the page; detection outlines scenery — houses, cars, trees — as « no load ».)_
- [x] **PV-T8** Missing object: the user draws around it and says what it is.
      **Done when** a drawn shape becomes a `VisionDetection` like the others.
      _(User change 2026-10-31: free text instead of a fixed category list, and the drawn part is sent to Muse (crop) + SAM
      to name, sort and outline it. Rectangle / free hand / magnetic lasso, several shapes editable (move, resize) before
      « Send the objects », `manual: true`; works when the AI failed; ≤ 30 per photo. In `/village` and the chat dialog.)_

- [x] **PV-T8b** (user request 2026-10-31) Correct an AI box and zoom the photo for precise drawing: « Adjust the box »
      on the selected object (move / corners / keyboard, Save / Cancel → `adjusted`, outline dropped); zoom 1–4× with pan
      (scroll, hand toggle while drawing), centred on the adjusted box. Also fixes overlays on tall photos (fitted width).

### V4 — Web: 3D object editor

- [x] **PV-T9** 3D shape with Meta models only (user change 2026-10-31: no fal.ai; the Meta API has no photo→3D model).
      `POST /api/vision/shape` → `server/perception/object-shape.ts`: one Spark call on a crop of the object returns an
      `ObjectRecipe` (≤ 12 primitive parts, colours, main body carries the photo); Meta failure, spend cap, 60 s timeout (SSE steps),
      empty recipe (`recipeIssue`, after `fitRecipe` stretches it to the photo box) → `silhouette` mode (SAM outline, else box, extruded in the browser).
      Hook `useObjectShape` (network failure → silhouette too). **Done when** tests cover recipe, each fallback and the
      mock recipes; no error is ever shown. _(Nothing stored: no GLB, crop sent inline.)_
- [x] **PV-T9b** Spark answered > 60 s on a building (user, 2026-11-01): it now returns an `ObjectKit` (archetype, proportions,
      3 colours, counts; ≈ 80 tokens) and `kitToRecipe` builds the parts from templates; standard model only, crop ≤ 768 px.
- [x] **PV-T9c** Free recipe (user, 2026-11-02: imagine full parts for every object type, even half-visible): archetypes
      without a real template (`other`, `water`, `person`, `animal`, `bush`) get a second Spark call on the same crop
      (`describeParts`, `ObjectParts` schema) listing the solid parts; the prompt names the cut photo edges so the WHOLE
      object is imagined. Adopted as `source: 'free'` (kit fallback on failure); no kit rebuild, no outline fit, no critic
      round over it. _(Live probe 2026-11-02: whole person 12 parts in 17 s; legs-cut person imagined legs + shoes in 30 s;
      e2e recipe in 46 s.)_
- [x] **PV-T10** `object-editor-3d.tsx`: R3F viewer (orbit, auto-fit, lazy-loaded) of the `useObjectShape` result:
      recipe parts merged (reuse `merge-parts` / scene palette) with the photo on the `frontPartIndex` part's front face
      (texture offset/repeat = detection box), or the `silhouetteRings` extrusion (depth per category) with the photo on the front.
      _(Done: UVs point into the whole photo instead of offset/repeat; one merged vertex-coloured mesh + one photo mesh (2 draw
      calls, < 15 k triangles); `ObjectShapePanel` in the /village aside, every object (scenery too, user request), one Spark call per object per photo.
      Chat dialog keeps detection only. Screens 1440 + 390, dark + light checked.)_
      **Done when** both modes render in dark/light, 1440 and 390 px, within `docs/performance.md` budgets.
- [x] **PV-T11** Edit panel: name, category, sector, watts (catalog bounds), quantity, usage hours preview
      (engine curve, chart), scale/color (visual only). Copilot tool `edit_appliance` proposes the same
      fields (confirmed via `confirm-proposal-dialog`). **Done when** hook `use-appliance-draft` is tested.
      _(Done 2026-10-31, user request « every object usable in the simulation, charge by hand or by AI »: `ApplianceInsertPanel`
      AI estimate / manual, name, type, sector, watts (catalog bounds), quantity, engine preview `applianceSummary`; scenery
      can be inserted too (`other`). Not done: usage-hours chart, scale/colour, copilot tool `edit_appliance` → PV-T11b.)_

### V5 — Insert into the simulation

- [x] **PV-T12** **Insert into simulation** → store `applyProposal({ appliances })`, immediate re-run.
      **Done when** strategies and metrics update and the copilot can explain the change with evidence.
      _(`ApplianceInsert`: insert / update / remove, id `vision-<photoKey>-<det>`, « In simulation » chip. The copilot receives the
      input with each question; whether it explains the change with evidence is not checked yet.)_
- [x] **PV-T11b** Rest of PV-T11: usage-hours chart (engine curve), scale / colour (visual only), copilot tool
      `edit_appliance` proposing the same fields (confirmed via `confirm-proposal-dialog`).
      (Done 2026-11-02 in 3 slices: (1) 24 h engine-curve bars in the insert panel (`ApplianceCurveChart`,
      hook `curve`, sr summary, keys `insertCurveTitle/Summary`); (2) viewer size slider 50–200 % + tint picker,
      per object, viewer-local state only, never stored (keys `model3dScale/Tint/DisplayReset`); (3) `edit_appliance`
      tool merging one line into a full-list proposal via the shared proposal tail, dialog diff lines per changed
      line (feeder + load, position when set, removals last) with per-line ids, partial approval restoring
      unchecked edits/removals, mock trigger + eval case 17, keys `diffApplianceValue/Removed`.)
- [x] **PV-T13** 3D village: appliance markers near their sector building (GLB thumbnail or stylized icon)
      with tag `name · quantity × W`; 2D diagram and settings list show the same; remove/edit from the list.
      **Done when** an appliance list of 30 stays within the scene budget (`make scene-audit`).
      _(Done 2026-10-31: `ui/appliance-markers.tsx` (3 instanced draw calls, ≤ 6 tags or the selected sector's),
      2D « n added », `ApplianceList` on /village + /simulation Buildings tab. Budget by construction; `make scene-audit`
      not run with 30 lines (needs a server and loads no appliances).)_
- [x] **PV-T14** Copilot tools `run_scenario`, `propose_change`, `get_sector_metrics` accept and report
      `appliances`. **Done when** eval case "why does the water sector run out at 19 h?" cites the pumps.
      _(Done 2026-11-02: shared `summarizeAppliances` (engine loads + sector/overall totals); `appliances` exposed
      in both patch schemas; sector lines + `water_applianceKwh/PeakKw/Count` evidence; run totals; proposal
      after-list + `applianceKwhDelta`; mock cites pump names + kWh; prompt 2b hint; eval case 18.)_

## Env vars (add to `src/lib/env.ts`, `.env.example`, `docs/setup/env.md`)

- Detection and SAM reuse `META_VISION_MODEL` (default `muse-spark-1.3`) and `META_SEGMENT_MODEL` (default `sam-3.1`).
- No 3D-specific variable: the shape recipe uses `META_VISION_MODEL` and the spend cap.

## Cost per photo (estimate)

1 Muse call (≈ 1 image + ~300 output tokens) + N SAM calls (N = distinct labels, ≈ $0.0025 each)

- 1 Spark call per object when « Generate the 3D model » is clicked (≈ 1 crop ≤ 768 px + ~80 output tokens, kit). No LLM call for watts or curves.

## Exit criteria

- `make check` green, `make check-i18n` green, `make e2e` covers: sample photo → select fridge → insert →
  comparison changes (mock provider).
- Design gate (`/design-check`) for the detection editor, the 3D editor and the village markers.
- Manual scenarios in `test-scenarios/05-copilote.md`, `02-simulation.md` and `00-parcours-demo.md`.

## Sources

- Meta image understanding / grounding: https://dev.meta.ai/docs/image-understanding
- Structured output: https://dev.meta.ai/docs/structured-output
- SAM on Meta Model API: https://dev.meta.ai/docs/sam/overview · https://dev.meta.ai/docs/sam/segmenting ·
  https://dev.meta.ai/docs/sam/client-libraries · https://dev.meta.ai/models/sam-3-1
- SAM wire grammar: https://pypi.org/project/meta-sam-parser/ · example: https://github.com/anthonynolan/sam3
- SAM 3D Objects hosted (not used, Meta-only rule): https://fal.ai/models/fal-ai/sam-3/3d-objects/api ·
  https://runware.ai/docs/models/meta-sam-3d-objects
