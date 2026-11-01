# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-01 (PF-T3 roofline, PF-T4 repetition, PF-T5 perspective) · **By:** Claude Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

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

- **3D fidelity (priority, user)**: plan `docs/tasks/PV-shape-fidelity.md`; PF-T1 (photo + SAM mask), PF-T2 (colours), PF-T3 (roofline → `prism` gables), PF-T4 (houses / windows, `repetition.ts`), PF-T5 (yaw, `perspective.ts`) done → PF-T6 fit by optimisation next.
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
- Free placement: visual `position` separate from the feeder `sector`; engine sectors stay 6 (plan only).

## Files touched this session

- PF-T3: `roofline.ts`, `withMeasuredRoof`, `KitRoof`, `prism`/`apex`, `unitPrism`, V57. Docs: contracts, copilot, PV-shape-fidelity.
- PF-T4: `perception/repetition.ts`, `sampleObjectGray`, `withMeasuredRepetition`, `details.units`, V58.
- Photo removed from 3D (V55/V59 rewritten); AI materials: `RECIPE_MATERIALS`, `kit.materials`, `surface-look.ts`, panel line, V60.
- PF-T5: `perception/perspective.ts`, `measuredYaw`, `recipe.yaw`, `fitRecipe(…, yaw)`, `recipeMesh` rotateY, test fixture `render-facade.ts`, V59.
- Earlier: shape (`lib/object-*`, `server/perception/*`, `api/vision/shape`, `use-object-shape`, `ui/object-*`); boxes: `utils/stacking.ts`, `detection-canvas`, `draw-overlay`, `globals.css`, `village-editor-page`; docs: copilot, contracts, PV task, PV-free-placement (new), tasks README; messages ×3; scenarios V47–V54.
