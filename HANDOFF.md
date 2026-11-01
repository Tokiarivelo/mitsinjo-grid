# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-01 (PR-2.2 done, car 93, PR-2.3 next) · **By:** Muse Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Committed: `18f20a4` (PR-0.7), `de147e1` (PR-0.4 machinery), `70ae224` (PR-2.1) — unsigned (sandbox GPG). PR-2.2 ready to commit.
- **PR-2.2 done:** `withProfileBody` — vehicle/cabinet/machine main body = SAM outline extruded (plate notches, per-wheel wells, yaw pre-squeeze in world units, fit.iou re-scored). Car 92 → 93 (IoU 0.97, edge 0.92, ΔE 3.2); fridge steady 97; mean 90.
- Loop lessons: global band cut punched the middle (−3 %); shrink-then-expose buried glass; squeeze must use world units (frame h·aspect), proved by pixel-diff bisection.
- **Meta still out:** PR-0.4 live fixture, PR-0.5, PR-0.6-live blocked.

## Next task

- **Commit** PR-2.2, then **PR-2.3 `lathe`** (tank/pot/bulb bodies from radius-vs-height profile; report ΔE on lamp glass).
- Then PR-2.4 tree envelope → PR-2.10, PR-0.6, S4 bet. Free placement PP-T1…T8. PV-T14 + PV-T11b.

## Decisions taken

- Slab yields to plates (notch to old box top when straddling) and wheels (wells up to wheel tops); yaw gate 0.26 rad + feasibility bail.
- fit.iou re-scored after profiling (shipped silhouette ≠ fitted template); silhouetteRings largest-first reused, no duplication.
- Scenario V70 added (visible car-shape change).

## Files touched this session

- New: `server/perception/profile-body.ts`, `__tests__/profile-body.test.ts`.
- `server/perception/object-shape.ts` (wire + rescore), `mask-outline.ts` (export simplifyRing).
- `docs/tasks/PV-shape-realism.md` (PR-2.2 + loop row), `test-scenarios/06-village.md` (V70, gitignored).
