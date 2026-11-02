# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-01 (PR-0.4 done, PR-0.6 new next) · **By:** Muse Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Committed through loop pass (`a822f10`). Uncommitted: PR-0.4 tick. Standing: commit each, unsigned fallback, always continue.
- **Meta back:** SAM 1.9s, Spark 11s (was aborts/>150s). PR-0.4 live capture works (refrigerator, replay 92).
- User ordered: do ALL planned tasks, then a full image-recognition + imagined-3D investigation.
- **PR-2.18 done:** `graph-edits.ts` `applyEdit` — openings re-tile, chimney seats, parts move, metric via scale, edited estimated. API-only, goldens identical, suite 303 green.
- **PR-2.17 done:** `wall-openings.ts` + house panels wire — segmented walls, centred leaves (measured), overlays fallback; panel class = on-face only. Goldens identical; cottage e2e 86→90, Viol 0.
- **PR-2.16 done:** `hidden-sides.ts` — back facade/end windows/rear door as inferred, low-yaw gate, set-atomic room. Cottage 9→11, scores identical, Viol 0.
- **PR-2.15 done:** DimStatus on parts + recipe (pipeline stamping), panel Dim/Parts lines (fr/en/mg), report Status col. Goldens identical + Status (car M1 I11).
- **PR-2.14 done:** `object-graph.ts` — graph (parents + 4 statuses), constraint pass after wheels/panels/chimney/fit (rescore on fix), Viol column in report (0 everywhere). Goldens identical.
- **PR-0.8 done:** landmark term (0.35/0.3/0.2/0.15); live-car e2e 0.95, 90 → 91; goldens identical.
- **PR-2.12/2.13 done:** shared yaw gates (0.3/1.05), house backs mirror ≤ 17°; loop pass clean (mean 93).
- **PR-2.19/2.20/2.21 done:** box-only colour cap 0.3, on-demand outline, SAM noun table. Goldens identical.
- **PR-2.11 done:** red taillights + rear bumper/trunk per subtype; goldens identical.
- **PR-2.10 done:** chimney stacks from masks; cottage e2e IoU 0.98 → 0.96; goldens identical.
- Loop lessons: global band cut −3 %; shrink-then-expose buries glass; world-unit squeeze; pixel-count confidence perverse without outline.
- **Meta still out:** PR-0.4 live fixture, PR-0.5, PR-0.6-live blocked.

## Next task

- **Commit** PR-0.4 tick, then **PR-0.6 Spark critic** (check code state; live round now possible).
- PR-0.5 needs 10 USER photos (only vision-room.jpg in repo) — ask user, don't block. Then S3/S4, PR-5.1/5.2, imagined-3D investigation.
- Blocked on Meta (probe when reached): PR-0.4, PR-0.5, PR-0.6-live, PR-3.1, PR-3.4, PR-4.x.
- Free placement PP-T1…T8. PV-T14 + PV-T11b.

## Decisions taken

- Slab yields to plates (notch to old box top when straddling) and wheels (wells up to wheel tops); yaw gate 0.26 rad + feasibility bail.
- fit.iou re-scored after profiling (shipped silhouette ≠ fitted template); silhouetteRings largest-first reused, no duplication.
- Plan refined from archi workflow (2026-11-01): target pipeline + skills map in PV-shape-realism.md; new PR-0.8, PR-2.14–2.16; Blender/GLB/VGGT out.
- Scene/status/parametric rules adopted: unified 4 statuses, PR-2.17 real openings, PR-2.18 `applyEdit`; LLM = params only, engine builds all geometry.
- Green-Mini chain: no outline → box-only sampling → c=1.0 → hedge wins. Fixed by 2.19 (cap) + 2.20 (fetch) + 2.21 (nouns).

## Files touched this session

- New `object-graph.ts` + `__tests__/object-graph.test.ts`; `mask-geometry.ts` (roofTopAbove).
- `mask-chimney.ts` (shared helper), `object-shape.ts` (4 constraint sites + rescore), `shape-report.ts` + test (Viol).
- `__tests__/object-shape.test.ts` (lint fix), `docs/tasks/PV-shape-realism.md` (tick + log).
