# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-31 (PV-T8b) · **By:** Claude Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` (PV) / `feat/meta-models` · **PR:** none yet · last commit ee7b654; fire alarm work below **uncommitted**

## State

- Plan `docs/tasks/PM-meta-models.md`. Done: M1-T1…T5 (impact, clinic guard, "now", undo, per-line approval), M3-T1/T2 (voice).
- **M1-T5** (K3): checkbox per proposal line (`useProposalSelection`, `utils/proposal-parts.ts`); engine block + clinic guard
  follow the checked lines (`lib/proposal-impact.ts`, shared with `propose_change`); decision carries `skipped`; mock cuts
  every sector named before « garde / keep / sauf ». Scenarios A88–A92.
- **Fire alarm (M2-T1 ✓, M2-T2 ✓ except chat button, M2-T3 code only):** engine `fire` event (0 kW cap that beats caps +
  floor, `FIRE_ISOLATION`, v0.4.0, `src/fire.ts`); store `reportFire`; `features/fire-alert` (auto snackbar, big sticky banner
  in AppShell, compact banner in the viewport, « Report a fire » in every view HUD + the deck); 2D « On fire » card + cut wire;
  3D `fire-effects.tsx` (flames, instanced smoke, light on high). Scenarios S83–S88.
- Checks (PV-T8b): tsc ✓, eslint ✓, i18n ✓, web tests all pass (vitest exits 1 on jsdom navigation noise, also on clean tree);
  engine sweep < 50 ms bench fails on this machine with or without changes.

## Next task

- **First: PV vision insert** (`docs/tasks/PV-vision-insert.md`, branch `claude/object-detection-3d-editor-gxfzw1`).
  V1 done: PV-T1 catalog, T2 `input.appliances` in sector demand (v0.5.0), T3 strategies/warnings test. PV-T4 ✓ `detectAppliances` in `server/perception`. PV-T5 ✓ (SAM boxes + mask outlines via `@meta-sam/parser`). PV-T6 ✓ `POST /api/vision` (SSE). PV-T7 ✓ detection canvas; `/village` « Village editor » menu page (user request) + chat dialog shortcut + live village preview; detection also outlines scenery (no load) so outdoor photos are not empty; photo normalized server-side with sharp (EXIF, ≤ 1280 px), hosted on R2 and sent by link (base64 fallback). PV-T8 ✓ (reworked on user request): rectangle / free hand / magnetic lasso (`utils/shapes.ts`, `utils/edge-map.ts`, `use-shape-editor`, `use-edge-map`, `DrawOverlay`, `DrawPanel`), shapes editable before « Send », free-text hint; `/api/vision` `regions` → crop + Muse `identifyRegion` + SAM (`server/perception/region.ts`), `vision_regions` SSE. Scenarios V15–V22. Object names localized (`labels.fr/mg` from the model, `localLabel`, `useDetectionLabel`; V23–V24). Sidebar fold to icon rail on xl (`use-sidebar-collapsed`, T25–T26). PV-T9 ✓ **Meta models only** (user: no fal.ai; Meta API has no photo→3D model): `POST /api/vision/shape` → Spark `ObjectRecipe` (≤ 12 primitives + colours, photo on the front part); failure / poor recipe (`recipeIssue`) → `silhouette` (SAM outline extruded in the browser); `useObjectShape`, `@/lib/object-shape`. PV-T10 ✓ « 3D model » block in the /village aside (`ObjectShapePanel`, lazy `object-editor-3d`, `utils/object-geometry`; appliances only, one Spark call per object per photo; V25–V29). PV-T8b ✓ (user request) « Adjust the box » + photo zoom/pan (`usePhotoZoom`, `ZoomControls`, `adjustBox`; V30–V35). Next **PV-T11** (edit panel). Open question for the user: scenery (« No load ») → turn into a load in PV-T11? Other items wait.
- Live check with a Meta key: does Spark call `control_playback` for "pause" / "go to 18:00"? Note it in docs/copilot.md.
- Screenshots not taken: M1-T5 card, fire banner/snackbar, 3D fire, 2D « On fire » (dark + light, 390 px); 3D fps with a fire.
- `make e2e` when convenient. Then M2-T4 (`get_incidents`, restore via `propose_change`, chat fire button) or **M1-T6** (4 eval cases).

## Decisions taken

- PV-T9: AI = Meta models only for now. Shape route returns JSON (not SSE); nothing stored. `vision-request.ts` shared by both vision routes; `pathToRings` moved to `@/lib/vision` (reads H/V).
- Clinic guard + decision lock are code; the model is only told. Summary carries no energy numbers. Audio not stored (WAV).
- "Now" = app hour (system note). Undo restores the whole input (also later slider edits). History not kept on reopen.
- `control_playback` is the only tool applied without approval: it moves the view, never inputs or results.
- Full screen and overview incident screen built without mockup (stitch-map notes). Modals render outside `GlassPanel`.
- K3: lines with no dialog row (solar profile, meter readings, shares, weights) always go with the patch. No ICU plural in
  the approve label (test i18n only does `{x}`).

## Files touched this session

- PV-T8b: canvas, draw-overlay, zoom-controls + use-photo-zoom (new), session `adjustBox`, editor `load`, `adjusted` flag, messages ×3, docs.
- PV-T10: `features/vision-insert/{ui/object-editor-3d,ui/object-shape-panel,utils/object-geometry}` (new), page, hook cache, messages ×3, docs village/stitch-map/contracts/PV task.
- PV-T9: `lib/object-shape.ts` (new), `lib/vision.ts`, `server/perception/{shape,object-shape,vision-request}.ts` (new), backend/meta/mock/client/schemas/index/mask-outline, `app/api/vision/route.ts`, `app/api/vision/shape/route.ts` (new), `use-object-shape` (new) + tests; docs contracts, copilot, architecture, PV task.
