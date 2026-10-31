# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-31 (PV-T11/T12/T13) · **By:** Claude Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Plan `docs/tasks/PV-vision-insert.md`. Done: PV-T1…T10, T8b, **T11 (core) + T12 + T13** this session. Other plans: `docs/tasks/PM-meta-models.md`
  (M1-T1…T5, M2-T1/T2 fire alarm, M3-T1/T2 voice done).
- **3D shape fix (user: lamp post always fell back to « outline »):** thin objects had no part ≥ 8 % of the box → `no_body`.
  Now `fitRecipe` (`@/lib/object-shape`) stretches parts to fill the box and takes w/h from the photo; `recipeIssue` only refuses
  a near-empty recipe. Spark gets an upscaled square crop (`shape-crop.ts`, ≥ 640 px), the box ratio and a thin-object rule.
  Panel note says why, with « Try the AI shape again »; an adjusted box gets a new recipe.
- **One colour per object** (user): `utils/mark-color.ts` (golden-angle hue + 3 lightness tiers), CSS `[data-mark]` → `--mark`
  from `--theme-mark-s/l` (dark/light); photo outline + list row border use it.
- **Add to the simulation** (user: every object, charge by hand or by AI): `useApplianceDraft`, `utils/appliance-draft.ts`,
  `ApplianceInsertPanel` + `ApplianceInsert` (store `applyProposal({ appliances })`), engine `applianceSummary` (preview).
  AI estimate = AI category + catalog default W + suggested sector; manual = catalog-bounded. Scenery insertable as `other`.
  « In simulation » chip in the list. Shared `FIELD_CLASS` moved to `components/ui/field.ts`.
- **PV-T13:** `SceneModel.appliances` (`utils/appliance-markers.ts`, engine profile at t), `ui/appliance-markers.tsx`
  (3 instanced draw calls, tags ≤ 6 or selected sector), 2D « n added », `ApplianceList` (+ `useSimulationAppliances`) on
  /village and /simulation Buildings tab.
- Checks: tsc ✓, eslint ✓, i18n ✓, web tests (3D, village, simulation: 307) ✓, engine ✓ except the known sweep bench.

## Next task

- **PV-T14** copilot tools accept and report `appliances` (eval: water runs out at 19 h → cites the pumps). Then **PV-T11b**
  (usage-hours chart, copilot `edit_appliance`). `make scene-audit` with 30 lines not run (no server).
- Live check with a Meta key: lamp post photo (scenario V36) now gives « AI shape ».
- Screenshots not taken: /village insert form + colours (dark + light, 1440 / 390), M1-T5 card, fire banner, 3D fire.
- `make e2e` when convenient. Then M2-T4 or M1-T6.

## Decisions taken

- Spark recipe is repaired, not rejected (`fitRecipe`); the photo box is the truth for width / height.
- « AI » power = the AI's category → engine catalog watts. The LLM never sends watts (PV principle kept).
- Appliance id `vision-<photoKey>-<det id>`: stable per photo, no clash across photos.
- Insert applies directly (no confirm dialog): it is the operator's own edit, removable at once.

## Files touched this session

- Shape: `lib/object-shape.ts`, `server/perception/*shape*`; colours: `globals.css`, `utils/mark-color.ts`, `detection-canvas`.
- Insert: engine `appliances/load.ts`, vision-insert `use-appliance-draft`, `use-simulation-appliances`, `appliance-{draft,insert,insert-panel,list}`.
- 3D: microgrid-3d `types`, `to-scene-model`, `{utils,ui}/appliance-markers`, `village-canvas`, `grid-diagram`. Docs + messages ×3; V28, V36–V46, S89.
