# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-01 (3D kit for Spark + free-placement plan) · **By:** Claude Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Plan `docs/tasks/PV-vision-insert.md`: PV-T1…T13, T8b, T9b done. Other plans: `docs/tasks/PM-meta-models.md` (M1-T1…T5, M2-T1/T2, M3-T1/T2).
- **3D shape (user reports):** `fitRecipe` stretches parts to the photo box; crop `shape-crop.ts` 640–768 px. Spark now answers an
  `ObjectKit` (archetype, proportions, 3 colours, counts; `@/lib/object-kit` → `kitToRecipe` templates), standard model only,
  because a free 12-part recipe took > 60 s on a building. 60 s limit, `failureOf` causes (`timeout`/`http_n`/`network`),
  SSE steps crop → model → fit on `/api/vision/shape` (`sseResponse`), only lasting answers cached (`keepShape`).
- **3D on demand:** select = `peek`, Spark only on « Generate the 3D model »; `.viewer-studio` backdrop, rim light, contact shadow.
- **Overlapping boxes:** `utils/stacking` (`paintOrder`, `pickAt` cycles); handles outside the shape.
- **One colour per object:** `utils/mark-color.ts`, CSS `[data-mark]`.
- **Add to the simulation:** `useApplianceDraft`, `ApplianceInsert(Panel)`, engine `applianceSummary`; AI = category → catalog W.
- **PV-T13:** `SceneModel.appliances`, `ui/appliance-markers.tsx`, 2D « n added », `ApplianceList` on /village and /simulation.
- Checks: tsc ✓, eslint ✓, i18n ✓, vitest (lib, perception, vision api, vision-insert, microgrid-3d) ✓. Live Meta not checked: V47–V48, V53–V54.

## Next task

- **3D fidelity (priority, user)**: plan `docs/tasks/PV-shape-fidelity.md`; PF-T1 (photo projected + SAM mask) and PF-T2 (measured colours) done → PF-T3 roofline next.
- **Free placement** (user: « Sector » too static): plan `docs/tasks/PV-free-placement.md` (position + feeder, PP-T1…T8).
- **PV-T14** copilot tools report `appliances`; then **PV-T11b** (usage-hours chart, `edit_appliance`).
- Screenshots not taken: /village insert form, colours, viewer (dark + light, 1440 / 390). `make e2e` when convenient.

## Decisions taken

- Spark classifies (kit), templates build geometry; the photo box is the truth for width / height.
- « AI » power = the AI's category → engine catalog watts. The LLM never sends watts.
- Appliance id `vision-<photoKey>-<det id>`. Insert applies directly (removable at once).
- Free placement: visual `position` separate from the feeder `sector`; engine sectors stay 6 (plan only).

## Files touched this session

- Shape: `lib/object-shape.ts`, `lib/object-kit.ts`, `server/perception/{shape,meta,client,object-shape,shape-crop,vision-request}.ts`,
  `app/api/vision{,/shape}/route.ts`, `hooks/use-{object-shape,elapsed-seconds}.ts`, `ui/object-{shape-panel,editor-3d}.tsx`.
- Boxes: `utils/stacking.ts`, `detection-canvas`, `draw-overlay`, `globals.css`, `village-editor-page`.
- Docs: copilot, contracts, PV task, PV-free-placement (new), tasks README; messages ×3; scenarios V47–V54.
