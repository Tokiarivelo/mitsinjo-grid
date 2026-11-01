# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-01 (PR-2.6 done, PR-2.7 next) · **By:** Muse Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Committed: `18f20a4` (PR-0.7), `de147e1` (PR-0.4 machinery), `70ae224` (PR-2.1), `1b9c603` (PR-2.2), `89e0078` (PR-2.3), `1824421` (PR-2.4), `d018920` (PR-2.5) — unsigned (sandbox GPG). PR-2.6 ready to commit.
- **PR-2.2 done:** `withProfileBody` — vehicle/cabinet/machine main body = SAM outline extruded (plate notches, per-wheel wells, yaw pre-squeeze in world units, fit.iou re-scored). Car 92 → 93 (IoU 0.97, edge 0.92, ΔE 3.2); fridge steady 97; mean 90.
- **PR-2.3 done:** `lathe` primitive — `profile` ([r, y], y non-decreasing) → solid of revolution, `unitLathe`, hull rings, frustum-stack ray clip. Tank + lamp head use static profiles. Lamp 86 → 87 (IoU 0.95, edge 0.91, ΔE steady 7.3 — sits in pole pixels); mean 90.
- Loop lessons: global band cut punched the middle (−3 %); shrink-then-expose buried glass; squeeze must use world units (frame h·aspect), proved by pixel-diff bisection.
- **Meta still out:** PR-0.4 live fixture, PR-0.5, PR-0.6-live blocked.

## Next task

- **Commit** PR-2.6, then **PR-2.7 windows/doors from masks** (min-area box per mask → inset glass/door panels, replaces `spread()`).
- **PR-2.6 done:** `withMaskWheels` — Kasa circle fit → tyre + rim per mask, mirrored, count = masks, budget backstop. Live-car e2e IoU stable; goldens identical; mean 93.
- **PR-2.5 done:** `fetchPartMasks` — concept batch on the crop (shared 5 s deadline, meta-only, ≤ 8/concept), attached as `ObjectShape.partMasks`. Scores identical (no consumer yet); mean 93.
- **PR-2.4 done:** `withLatheBody` — round mains = outline half-width per row (24 rows + poles), resized round, filler dropped. Tree 89 → 99 (IoU/edge 0.99); lamp 87 → 89 (ΔE 7.4); mean 93. Budget fix: allocation-free `clipLathe` (render 132 → 32 ms, pixels identical).
- Then PR-2.4 tree envelope → PR-2.10, PR-0.6, S4 bet. Free placement PP-T1…T8. PV-T14 + PV-T11b.

## Decisions taken

- Slab yields to plates (notch to old box top when straddling) and wheels (wells up to wheel tops); yaw gate 0.26 rad + feasibility bail.
- fit.iou re-scored after profiling (shipped silhouette ≠ fitted template); silhouetteRings largest-first reused, no duplication.
- Scenario V70 added (visible car-shape change).

## Files touched this session

- New: `server/perception/profile-body.ts`, `__tests__/profile-body.test.ts`.
- `server/perception/object-shape.ts` (wire + rescore), `mask-outline.ts` (export simplifyRing).
- `docs/tasks/PV-shape-realism.md` (PR-2.2 + loop row), `test-scenarios/06-village.md` (V70, gitignored).
