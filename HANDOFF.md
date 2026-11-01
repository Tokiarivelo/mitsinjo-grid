# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-01 (PR-2.12+2.13 done, PR-0.8 new next) · **By:** Muse Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Committed through `b6a6c84` (PR-2.19–2.21). Uncommitted: PR-2.12+2.13. Standing: commit each, unsigned fallback, always continue.
- User ordered: do ALL planned tasks, then a full image-recognition + imagined-3D investigation.
- **PR-2.12 done:** `MASK_YAW_MAX/HARD_MAX` (0.3/1.05) shared gates; panels ≤ 17° mirror both archetypes, 17–60° near-only, > 60° template; profile 0.26 → 0.3. House e2e 6 → 8 parts; goldens identical.
- **PR-2.13 done:** loop pass over 2.10–2.12 — all criteria met (mean 93, IoU 0.98, edge 0.91, ΔE 3.4, ≤ 267 ms), no regressions, no designer review (no Look task).
- **PR-2.19/2.20/2.21 done:** box-only colour cap 0.3, on-demand outline, SAM noun table. Goldens identical; suite 1160 green.
- **PR-2.11 done:** red taillights + rear bumper/trunk per subtype; goldens identical; rear renders red.
- **PR-2.10 done:** chimney stacks from masks; cottage e2e IoU 0.98 → 0.96; goldens identical.
- Loop lessons: global band cut −3 %; shrink-then-expose buries glass; world-unit squeeze; pixel-count confidence perverse without outline.
- **Meta still out:** PR-0.4 live fixture, PR-0.5, PR-0.6-live blocked.

## Next task

- **Commit** PR-2.12+2.13 (`feat(web)`), then **PR-0.8 landmark term** (S0 leftover: part-centre distances as 4th score term; goldens neutral, live e2e stable).
- Then PR-2.14 graph → 2.15 status → 2.16 hidden sides → 2.17 openings → 2.18 edits (+ pass), S3/S4 as unblocked, PR-5.1/5.2 docs.
- Blocked on Meta (probe when reached): PR-0.4, PR-0.5, PR-0.6-live, PR-3.1, PR-3.4, PR-4.x.
- Free placement PP-T1…T8. PV-T14 + PV-T11b.

## Decisions taken

- Slab yields to plates (notch to old box top when straddling) and wheels (wells up to wheel tops); yaw gate 0.26 rad + feasibility bail.
- fit.iou re-scored after profiling (shipped silhouette ≠ fitted template); silhouetteRings largest-first reused, no duplication.
- Plan refined from archi workflow (2026-11-01): target pipeline + skills map in PV-shape-realism.md; new PR-0.8, PR-2.14–2.16; Blender/GLB/VGGT out.
- Scene/status/parametric rules adopted: unified 4 statuses, PR-2.17 real openings, PR-2.18 `applyEdit`; LLM = params only, engine builds all geometry.
- Green-Mini chain: no outline → box-only sampling → c=1.0 → hedge wins. Fixed by 2.19 (cap) + 2.20 (fetch) + 2.21 (nouns).

## Files touched this session

- `mask-geometry.ts` (shared gates), `mask-panels.ts` (ladder + house mirror), `profile-body.ts`, `mask-wheels.ts`, `mask-chimney.ts` (gate unify).
- `__tests__/mask-panels.test.ts` (backs, ladder), `__tests__/profile-body.test.ts` (0.28 pin).
- `docs/tasks/PV-shape-realism.md` (ticks + log), `test-scenarios/06-village.md` (V74).
