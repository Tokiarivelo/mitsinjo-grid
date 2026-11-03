# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-03 (PV-G live pass + PG-T20/T21) · **By:** Claude · **Branch:** stacked PRs

## Merge first (main needs an approving review)

#33 `feat/pg-t18-lost-job-chip-shots` → #34 `feat/pg-t22-live-stage-capture` → #35 `feat/pg-t20-archetype-stages`
(each based on the previous; merge in order, merge commits).

## PA — AI autonomous dispatch (other session, unchanged)

- PA-T2 done. Next **PA-3** (`docs/tasks/PA-ai-dispatch.md`): store `dispatchMode` / `dispatchLog` + Neon, `useAiDispatch`.

## PV-G — 3D by script (`docs/tasks/PV-shape-script.md`)

- **#33** chip cause `lost` (resume 404 = server restarted, model kept); `make improve-shot` (chip gate-out done).
- **#34 PG-T22 live** (Spark 1.3, Muse Image thatched house): Spark deleted the side-wall windows to raise the
  front score. Fixed: `sideFacing` (front score ignores side openings) + runner `canEdit` / `houseCanEdit`.
  Seed now 95/100. Stage capture + replay: `make facade-e2e … ID=x` → `make eval-stages` (captures gitignored).
  Designer ≈ 3/5: walls tan (photo average of plaster + timber), roof ends hipped vs drawn half-hip.
- **#35 PG-T20/T21**: `view-stages.ts` stages per archetype scored part by part on the views (`scoreViews`),
  parts tagged by kind, new SAM concepts, shared `stagedLoop`, views prompt variant (v2); viewer wheel rims and
  solar cell lines (`view-assemblies.ts`). Live car run: see PV-shape-script PG-T20 notes.

## Next

- PG-T22 to 4/5: wall colour from plaster only when a timber frame is drawn; half-hip from the side drawing.
- PG-T20 tuning from live logs (`[vision] 3D stage n/m wheels …`); materials stage needs a per-part colour metric.
- Known flakes: golden-shape timing under parallel load, `use-voice-input` silence timer (passes alone / reruns).

## Files touched (this session)

`features/vision-insert/{hooks/use-object-shape,utils/{view-assemblies,object-geometry}}`, `lib/object-shape.ts`,
`server/perception/{elevation-score,shape-stages,shape-stages-spark,stage-capture,view-stages,object-views,
object-shape,shape-script-prompt,meta,client,backend}.ts`, tests + `__fixtures__/views`, `scripts/improve-chip-shot.mjs`,
messages ×3, Makefile (`improve-shot`, `eval-stages`), docs (contracts, copilot, design/stitch-map, tasks
PV-shape-script / -realism), README, skill shape-3d. Scenarios V119–V125, V115 updated.
