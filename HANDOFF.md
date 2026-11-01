# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-01 (PR-0.8 done, PR-2.14 new next) · **By:** Muse Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Committed through `6aa8c9d` (PR-2.12+2.13). Uncommitted: PR-0.8. Standing: commit each, unsigned fallback, always continue.
- User ordered: do ALL planned tasks, then a full image-recognition + imagined-3D investigation.
- **PR-0.8 done:** landmark term — `Landmark` + `scoreLandmarks` (mean miss, 0 at ¼ width) + rebalanced weights (0.35/0.3/0.2/0.15); `buildLandmarks` + `scoreRecipe` masks param. Live-car e2e 0.95, 90 → 91; goldens identical.
- **PR-2.12/2.13 done:** shared yaw gates (0.3/1.05), house backs mirror ≤ 17°, near-only to 60°; loop pass clean (mean 93).
- **PR-2.19/2.20/2.21 done:** box-only colour cap 0.3, on-demand outline, SAM noun table. Goldens identical.
- **PR-2.11 done:** red taillights + rear bumper/trunk per subtype; goldens identical.
- **PR-2.10 done:** chimney stacks from masks; cottage e2e IoU 0.98 → 0.96; goldens identical.
- Loop lessons: global band cut −3 %; shrink-then-expose buries glass; world-unit squeeze; pixel-count confidence perverse without outline.
- **Meta still out:** PR-0.4 live fixture, PR-0.5, PR-0.6-live blocked.

## Next task

- **Commit** PR-0.8 (`feat(web)`), then **PR-2.14 object graph + constraints** (parent→child graph, clamp pass after reshapes, dimension status per node; test: floating panel pulled in, violations in report).
- Then 2.15 status → 2.16 hidden sides → 2.17 openings → 2.18 edits (+ pass), S3/S4 as unblocked, PR-5.1/5.2 docs.
- Blocked on Meta (probe when reached): PR-0.4, PR-0.5, PR-0.6-live, PR-3.1, PR-3.4, PR-4.x.
- Free placement PP-T1…T8. PV-T14 + PV-T11b.

## Decisions taken

- Slab yields to plates (notch to old box top when straddling) and wheels (wells up to wheel tops); yaw gate 0.26 rad + feasibility bail.
- fit.iou re-scored after profiling (shipped silhouette ≠ fitted template); silhouetteRings largest-first reused, no duplication.
- Plan refined from archi workflow (2026-11-01): target pipeline + skills map in PV-shape-realism.md; new PR-0.8, PR-2.14–2.16; Blender/GLB/VGGT out.
- Scene/status/parametric rules adopted: unified 4 statuses, PR-2.17 real openings, PR-2.18 `applyEdit`; LLM = params only, engine builds all geometry.
- Green-Mini chain: no outline → box-only sampling → c=1.0 → hedge wins. Fixed by 2.19 (cap) + 2.20 (fetch) + 2.21 (nouns).

## Files touched this session

- `model-score.ts` (term + weights), `score-shape.ts` (builder + masks param), `object-shape.ts` (rescore passes masks), `shape-capture.ts` (3-term note).
- New `__tests__/score-shape.test.ts`; `model-score.test.ts` (shift test), `mask-panels.test.ts` (e2e landmark).
- `docs/tasks/PV-shape-realism.md` (tick + log).
