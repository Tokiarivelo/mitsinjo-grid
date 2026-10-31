# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-31 (PV-T11/T12) · **By:** Claude Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Plan `docs/tasks/PV-vision-insert.md`. Done: PV-T1…T10, T8b, **T11 (core) + T12** this session. Other plans: `docs/tasks/PM-meta-models.md`
  (M1-T1…T5, M2-T1/T2 fire alarm, M3-T1/T2 voice done).
- **3D shape fix (user: lamp post always fell back to « outline »):** thin objects had no part ≥ 8 % of the box → `no_body`.
  Now `fitRecipe` (`@/lib/object-shape`) stretches parts to fill the box and takes w/h from the photo; `recipeIssue` only refuses
  a near-empty recipe. Spark gets a square upscaled crop (`server/perception/shape-crop.ts`, ≥ 640 px) + box ratio in the question
  - thin-object rule in the prompt. Panel note says why (Meta down vs unusable) + « Try the AI shape again » (`useObjectShape().retry`).
    Adjusted box (`adjusted`) → box in the cache key → new recipe.
- **One colour per object** (user): `utils/mark-color.ts` (golden-angle hue + 3 lightness tiers), CSS `[data-mark]` → `--mark`
  from `--theme-mark-s/l` (dark/light); photo outline + list row border use it.
- **Add to the simulation** (user: every object, charge by hand or by AI): `useApplianceDraft`, `utils/appliance-draft.ts`,
  `ApplianceInsertPanel` + `ApplianceInsert` (store `applyProposal({ appliances })`), engine `applianceSummary` (preview).
  AI estimate = AI category + catalog default W + suggested sector; manual = catalog-bounded. Scenery insertable as `other`.
  « In simulation » chip in the list. Shared `FIELD_CLASS` moved to `components/ui/field.ts`.
- Checks: tsc ✓, eslint ✓, i18n ✓, vision-insert + strategy-lab tests ✓ (119), engine ✓ except the known < 50 ms sweep bench.

## Next task

- **PV-T13** 3D village markers for inserted appliances (near their sector building). Then **PV-T11b** (usage-hours chart,
  copilot `edit_appliance`), PV-T12 live check: copilot explains an inserted pump with evidence.
- Live check with a Meta key: lamp post photo (scenario V36) now gives « AI shape ».
- Screenshots not taken: /village insert form + colours (dark + light, 1440 / 390), M1-T5 card, fire banner, 3D fire.
- `make e2e` when convenient. Then M2-T4 or M1-T6.

## Decisions taken

- Spark recipe is repaired, not rejected (`fitRecipe`); the photo box is the truth for width / height.
- « AI » power = the AI's category → engine catalog watts. The LLM never sends watts (PV principle kept).
- Appliance id `vision-<photoKey>-<det id>`: stable per photo, no clash across photos.
- Insert applies directly (no confirm dialog): it is the operator's own edit, removable at once.

## Files touched this session

- Shape: `lib/object-shape.ts`, `server/perception/{object-shape,shape,shape-crop(new),backend,meta}.ts`, `use-object-shape`, `object-shape-panel`.
- Colours: `globals.css`, `utils/mark-color.ts` (new), `detection-canvas.tsx`.
- Insert: engine `appliances/load.ts`, `use-appliance-draft`, `utils/appliance-draft`, `ui/appliance-insert{,-panel}` (new), page, index, `components/ui/field.ts`, `sector-rule-row`.
- Messages ×3; docs contracts, copilot, components, screens/village, stitch-map, PV task, README. Scenarios V28, V36–V43.
