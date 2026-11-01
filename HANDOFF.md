# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-01 (PR-0.1 flat renderer, Spark critic guide) · **By:** Claude Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Plan `docs/tasks/PV-vision-insert.md`: PV-T1…T13, T8b, T9b done. Other plans: `docs/tasks/PM-meta-models.md` (M1-T1…T5, M2-T1/T2, M3-T1/T2).
- **3D shape (user reports):** `fitRecipe` stretches parts to the photo box; crop `shape-crop.ts` 640–768 px. Spark now answers an
  `ObjectKit` (archetype, proportions, 3 colours, counts; `@/lib/object-kit` → `kitToRecipe` templates), standard model only,
  because a free 12-part recipe took > 60 s on a building. 60 s limit, `failureOf` causes (`timeout`/`http_n`/`network`),
  SSE steps crop → model → fit on `/api/vision/shape` (`sseResponse`), only lasting answers cached (`keepShape`).
- **3D on demand:** select = `peek`, Spark only on « Generate the 3D model »; `.viewer-studio` backdrop, rim light, contact shadow.
- **Add to the simulation:** `useApplianceDraft`, `ApplianceInsert(Panel)`, engine `applianceSummary`; AI = category → catalog W.
- **PV-T13:** `SceneModel.appliances`, `ui/appliance-markers.tsx`, 2D « n added », `ApplianceList` on /village and /simulation.
- Checks: tsc ✓, eslint ✓, i18n ✓, vitest (lib, perception, vision api, vision-insert, microgrid-3d) ✓. Live Meta not checked: V47–V48, V53–V54.

## Next task

- **3D realism (priority, user)**: task file `docs/tasks/PV-shape-realism.md` → PR-0.1 done → next **PR-0.2 score** (`scoreModel`), then PR-0.3/0.4, **PR-0.6 Spark critic** (user: Meta model compares crop | flat render, returns kit patch). Work with `/shape-3d`, judge with `/shape-loop` (or `/loop /shape-loop`). Meta only; photo never pasted, 64 px tileable swatches OK. Needs ~10 user photos for PR-0.5.
- Done before it: `PV-shape-fidelity.md` PF-T1…T9 (colours, roofline, rows, yaw, fit, fusion, golden set `make test-shape`); PF-T10 folded into PR-5.1/5.2.
- **Free placement** (user: « Sector » too static): plan `docs/tasks/PV-free-placement.md` (position + feeder, PP-T1…T8).
- **PV-T14** copilot tools report `appliances`; then **PV-T11b** (usage-hours chart, `edit_appliance`). Not done: screenshots, `make e2e`.

## Decisions taken

- Spark classifies (kit), templates build geometry; the photo box is the truth for width / height.
- « AI » power = the AI's category → engine catalog watts. The LLM never sends watts.
- Appliance id `vision-<photoKey>-<det id>`. Insert applies directly (removable at once).
- Roof = measured only (SAM outline skyline, segmented LSQ + BIC); pitched `building` → `house`; flat / no outline → stepped roof.
  Units = gables (≥ 2) > roof-band edge period > Spark; never on a flat `building`; 12-part budget trims windows first.
- Perspective: model turned by yaw (no homography); dead zone 6°.
- No photo on the 3D model (user, 2026-11-01): `recipeMesh` / `silhouetteMesh` return one geometry; `photo-mask.ts` removed.

## Files touched this session

- PR-0.1: `perception/flat-render.ts` (`renderFlat`, ray per pixel, z-buffer, Lambert), `partTransform` shared in `silhouette-fit.ts`, `hexToRgb`; skills shape-3d/shape-loop « Meta in the render loop ».

- Earlier (PF): roofline, repetition, silhouette-fit, fusion, golden set, perspective, photo removed — see `PV-shape-fidelity.md`.
