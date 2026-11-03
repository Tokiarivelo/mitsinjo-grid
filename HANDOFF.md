# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-03 (PG-T22 closed) · **By:** Claude · **Branch:** stacked PRs

## Merge first (main needs an approving review, or an admin merge by the owner)

#33 `feat/pg-t18-lost-job-chip-shots` (CI green) → #34 `feat/pg-t22-live-stage-capture` → #35
`feat/pg-t20-archetype-stages` (now also holds the PG-T22 close commit). Each is based on the previous: merge in
order, merge commits; after each merge the next PR retargets main and CI runs on it.

## PA — AI autonomous dispatch (other session, unchanged)

- PA-T2 done. Next **PA-3** (`docs/tasks/PA-ai-dispatch.md`): store `dispatchMode` / `dispatchLog` + Neon, `useAiDispatch`.

## PV-G — 3D by script (`docs/tasks/PV-shape-script.md`) — all tasks ticked

- **PG-T22 closed:** half-hip roof = `hip` part `clip` (vertical gable ends up to that share of the roof height),
  read on the front roof outline (`gableShare`, outer 4 % skyline columns; ≥ 0.2 → half-hip). Viewer
  (`unitHip(ridge, clip)`), flat render, silhouette fit, ShapeScript `set clip` (prompt v3). Half-timbered walls
  (`wallTimber`) take the plaster colour (`measureKitColors(…, { plaster })`).
- Live capture seed rebuilt 95 → 97 (roof 0.95 → 0.97); goldens mean 93; designer ≈ 4/5 (¾ viewer shot).
- Fixture fix: hand-made thatched roof box now bounds its ring (SAM boxes always do).

## Next

- Live re-run `make facade-e2e … ID=thatched` to confirm half-hip + plaster on real Meta answers (costs API).
- PG-T20 tuning from live logs; materials stage needs a per-part colour metric.
- Known flakes under load (load avg ≈ 17 here): golden-shape / model-score / engine timing budgets,
  `use-voice-input` silence timer — all pass alone.

## Files touched (this session)

`lib/{object-shape,shape-script}.ts`, `server/perception/{facade-house,color-measure,flat-render,silhouette-fit,
object-shape,shape-script-prompt}.ts`, `features/vision-insert/utils/object-geometry.ts`, tests (facade-house,
flat-render, color-measure, object-geometry), `__fixtures__/elevation`, docs (contracts, copilot, tasks
PV-shape-script / -realism). Scenarios V127–V129.

## Decisions

- Half-hip read on the front outline, not the side drawing (the outline already shows the vertical ends).
