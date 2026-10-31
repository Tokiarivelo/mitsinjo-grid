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

| Step              | Model / service                                                      | Input → output                                                                                                                                | Cost / limits                                                                                       |
| ----------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Detect + classify | `muse-spark-1.3` (Meta Model API, already used)                      | image + JSON schema → `[{label, category, bbox:[x_min,y_min,x_max,y_max]}]`, grid 0–1000, top-left origin; missing objects omitted            | tokens for 1 image + short JSON; values may exceed 1000 → clamp; counting imperfect                 |
| Precise outlines  | `sam-3.1` (Meta Model API, `POST /v1/responses`)                     | image + one noun phrase (`input_text`) → special-token text `<Nf>id<\|box;x1;y1;x2;y2;w;h[;c]\|><\|mask;…data=H,W,~payload\|>`, source pixels | ≈ $2.50 / 1k images; text prompts only on the API (no box/point prompt); one phrase per request     |
| Mask decode       | `@meta-sam/parser` (npm, 0.1.0, Meta)                                | SAM output → typed records, raster / COCO RLE / **SVG path**                                                                                  | check licence (`SEE LICENSE IN LICENSE`) before adding                                              |
| Photo → 3D        | **SAM 3D Objects** via fal.ai (`fal-ai/sam-3/3d-objects`) or Runware | cropped image (+ mask) → GLB (single mesh, optional baked texture) + PLY splat                                                                | **not on Meta Model API** → extra key; ≈ 5–30 s+, ≈ $0.02/object (unverified); hidden side invented |

Open checks before coding (the session network blocked `dev.meta.ai`): exact `sam-3.1` request metadata
(`mask_encoding`, `include_confidence`), max image size, rate limits, `@meta-sam/parser` licence, fal.ai price.

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
- [ ] **PV-T2** `applianceProfileKw(appliance): number[24]` = watts × quantity × duty / 1000; Zod schemas
      `ApplianceSchema`, `InputPatch.appliances`; demand model adds the profiles to their sector.
      **Done when** an input without appliances gives identical results (golden test) and one fridge adds
      exactly its curve to its sector; `ENGINE_VERSION` bumped.
- [ ] **PV-T3** Strategies, metrics and warnings see appliance load like any sector load (critical share
      from the sector). **Done when** `compare()` changes as expected on `cloudy_day` with 5 pumps on `water`.

### V2 — Server: detection and outlines

- [ ] **PV-T4** `server/vision/detect.ts`: Muse Spark 1.3, Responses API, image as data URL, structured
      output (JSON schema with the category enum), clamp 0–1000 → 0–1, drop unknown categories to `other`.
      **Done when** unit tests cover parsing, clamping, out-of-enum labels and a malformed reply.
- [ ] **PV-T5** `server/vision/segment.ts`: one `sam-3.1` call per distinct label (parallel, timeout 8 s),
      decode with `@meta-sam/parser` → SVG path; match SAM instances to Muse boxes by IoU.
      **Done when** tests run on a recorded SAM response fixture; on timeout the box outline is kept.
- [ ] **PV-T6** Route `app/api/vision/route.ts` (POST image ≤ 4 MB, resized client-side to ≤ 1280 px)
      streaming `vision_detections`; mock provider returns the fixture for `public/samples/vision-room.jpg`.
      **Done when** `make dev-mock` shows detections offline.

### V3 — Web: detection editor in the chat

- [ ] **PV-T7** `features/vision-insert/ui/detection-canvas.tsx`: image + SVG overlay (outline per object,
      hover/focus = highlight + label chip, click/Enter = select), keyboard and touch accessible,
      responsive (pinch-free, fits 320 px). Opened when an image is attached in the copilot.
      **Done when** component tests cover hover, select, empty result, error state.
- [ ] **PV-T8** Missing object: the user draws a box and picks a category (no AI call).
      **Done when** a manual box becomes a `VisionDetection` like the others.

### V4 — Web: 3D object editor

- [ ] **PV-T9** `server/vision/mesh.ts` + `vision_mesh_ready`: crop the selected object, call SAM 3D Objects
      (fal.ai, `FAL_KEY`, timeout 45 s), store the GLB (R2 via `server/storage/r2.ts`) and return its URL.
      Behind `VISION_3D_PROVIDER=fal|none` (default `none`).
      **Done when** tests mock fal.ai; without a key the stylized model is used with no error shown.
- [ ] **PV-T10** `object-editor-3d.tsx`: R3F viewer (orbit, auto-fit, lazy-loaded, mesh capped in faces or
      decimated) + stylized fallback per category (reuse `merge-parts` / scene palette).
      **Done when** both modes render in dark/light, 1440 and 390 px, within `docs/performance.md` budgets.
- [ ] **PV-T11** Edit panel: name, category, sector, watts (catalog bounds), quantity, usage hours preview
      (engine curve, chart), scale/color (visual only). Copilot tool `edit_appliance` proposes the same
      fields (confirmed via `confirm-proposal-dialog`). **Done when** hook `use-appliance-draft` is tested.

### V5 — Insert into the simulation

- [ ] **PV-T12** **Insert into simulation** → store `applyProposal({ appliances })`, immediate re-run.
      **Done when** strategies and metrics update and the copilot can explain the change with evidence.
- [ ] **PV-T13** 3D village: appliance markers near their sector building (GLB thumbnail or stylized icon)
      with tag `name · quantity × W`; 2D diagram and settings list show the same; remove/edit from the list.
      **Done when** an appliance list of 30 stays within the scene budget (`make scene-audit`).
- [ ] **PV-T14** Copilot tools `run_scenario`, `propose_change`, `get_sector_metrics` accept and report
      `appliances`. **Done when** eval case "why does the water sector run out at 19 h?" cites the pumps.

## Env vars (add to `src/lib/env.ts`, `.env.example`, `docs/setup/env.md`)

- `VISION_SAM_MODEL` (default `sam-3.1`), `VISION_DETECT_MODEL` (default `muse-spark-1.3`).
- `VISION_3D_PROVIDER` (`none` | `fal`), `FAL_KEY` (only if `fal`).

## Cost per photo (estimate)

1 Muse call (≈ 1 image + ~300 output tokens) + N SAM calls (N = distinct labels, ≈ $0.0025 each)

- 1 SAM 3D call per selected object (≈ $0.02, unverified). No LLM call for watts or curves.

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
- SAM 3D Objects hosted: https://fal.ai/models/fal-ai/sam-3/3d-objects/api ·
  https://runware.ai/docs/models/meta-sam-3d-objects
