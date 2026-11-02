# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-02 (PV-G G2–G3 + PG-T19) · **By:** Claude · **Branch:** main

## PA — AI autonomous dispatch (other session, unchanged)

- PA-T2 done (`decideDispatch`, `candidateActions`, anti-oscillation; 327 engine tests). Next **PA-3**
  (`docs/tasks/PA-ai-dispatch.md`): store `dispatchMode` / `dispatchLog` + Neon `dispatch_log`, hook `useAiDispatch`.

## PV-G — 3D by script, checked against the 2D drawing (`docs/tasks/PV-shape-script.md`)

- **PG-T10** assemblies: part options `leaves glazed panels sill lintel cap bulge`, `MAX_COMPONENTS = 32`;
  viewer expands (glazed double door, transom, stile, panels, lintels, chimney caps, eave roll) and drops
  details past 5 k triangles. Facade builder reads door glazing from SAM panes.
- **PG-T13/T14** `lib/shape-script.ts`: typed ops → pure `compileScript` (locks, budget, constraints),
  `recipeToScript` (facade house round-trips unchanged).
- **PG-T15/T16** `shape-stages.ts` `runShapeStages` (monotone, ≤ 3 rounds/stage) + Spark `proposeShapeOps`
  (prompt v1, `shape-script-prompt.ts`), wired in the facade path (`facadeStageLoop`).
- **PG-T17/T18** SSE `shape_stage` / `shape_stages_done`; stages past the 60 s answer run in a background job
  (`shape-jobs.ts`, ≤ 3 min), `GET|DELETE /api/vision/shape/stages` resume / cancel; hook swaps models in;
  `ImproveChip` on the viewer (en/fr/mg, aria-live).
- **PG-T19** tree / bush / pole / lamp post → `roundViewRecipe` (lathe of the drawn silhouette, no side);
  panel → hull path; tree prompt.
- Goldens mean 93 unchanged; thatched elevation 89/100 (mock proposer = seed).

## Next

- **PG-T22 live**: `make dev` with a Meta key on the thatched house → check logs `[vision] 3D stage n/4 …`
  and the chip (scenarios V112–V116); keep or reword prompt v1 from real answers; add stage replay to
  `make eval-shape` from captures.
- **PG-T20/T21**: per-archetype stages need a per-part metric on the views (SAM part boxes vs rendered parts).
- Known: timing asserts fail under parallel load only; chip gate-out static (login); jobs in memory.

## Files touched (this session)

`lib/{object-shape,shape-script}.ts`, `server/perception/{facade-house,shape-stages,shape-stages-spark,
shape-script-prompt,shape-jobs,object-shape,object-views,facade-specialist,meta,mock,client,backend,schemas,
vision-request}.ts`, `app/api/vision/shape/{route,stages/route}.ts`, `features/vision-insert/{hooks/use-object-shape,
utils/{openings,roof-trim,object-geometry},ui/{improve-chip,object-shape-panel}}`, messages ×3, docs (contracts,
copilot, architecture, design/stitch-map, screens/village, tasks PV-shape-script / -realism), README, skill shape-3d.
Scenarios V109–V118 (`test-scenarios/06-village.md`).
