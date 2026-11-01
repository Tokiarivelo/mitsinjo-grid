# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-01 (PR-2.10 done, PR-2.11 new next) · **By:** Muse Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Committed through `342344a` (PR-2.9). Uncommitted: PR-2.10 chimney (see Next). Nothing committed this session (no commit asked).
- **PR-2.10 done:** `withMaskChimney` — min-area rect per chimney mask (tilt ≤ 20°, yaw ≤ 0.3, ≤ 2), feet at eave, top follows mask (≥ ridge + 0.02), template replaced, decals fund room. Cottage e2e IoU 0.98 → 0.96, 9 → 10 parts; goldens identical; mean 93.
- **PR-2.9 done:** `part-fit.ts` — coordinate descent (wheels/cabin/eave, 3-start NM × 8 evals, 48-col grid, cached photo terms, keep iff +0.05). Car 93 → 93 (edge +0.01, IoU −0.01); car math 174 → 257 ms, all ≤ 300; mean 93.
- **PR-2.2 done:** `withProfileBody` — vehicle/cabinet/machine main body = SAM outline extruded (plate notches, per-wheel wells, yaw pre-squeeze in world units, fit.iou re-scored). Car 92 → 93 (IoU 0.97, edge 0.92, ΔE 3.2); fridge steady 97; mean 90.
- **PR-2.3 done:** `lathe` primitive — `profile` ([r, y], y non-decreasing) → solid of revolution, `unitLathe`, hull rings, frustum-stack ray clip. Tank + lamp head use static profiles. Lamp 86 → 87 (IoU 0.95, edge 0.91, ΔE steady 7.3 — sits in pole pixels); mean 90.
- Loop lessons: global band cut punched the middle (−3 %); shrink-then-expose buried glass; squeeze must use world units (frame h·aspect), proved by pixel-diff bisection.
- **Meta still out:** PR-0.4 live fixture, PR-0.5, PR-0.6-live blocked.

## Next task

- **Commit** PR-2.10 (`feat(web)`), then **PR-2.11 asymmetric vehicle rears** (red taillights at −x + rear bumper/trunk per subtype, funded by backstop; then PR-2.12, loop pass → PR-2.13).
- **PR-2.8 done:** `measureRegionColors` + `withRegionColors` — median colour per mask/rest, confidence-mixed. Live-car e2e stable; goldens identical; mean 93.
- **PR-2.7 done:** `withMaskPanels` — min-area rect panels (shell recolour, mirror/room logic, wheels+roof protected). Live-car e2e stable; goldens identical; mean 93.
- **PR-2.6 done:** `withMaskWheels` — Kasa circle fit → tyre + rim per mask, mirrored, count = masks, budget backstop. Live-car e2e IoU stable; goldens identical; mean 93.
- **PR-2.5 done:** `fetchPartMasks` — concept batch on the crop (shared 5 s deadline, meta-only, ≤ 8/concept), attached as `ObjectShape.partMasks`. Scores identical (no consumer yet); mean 93.
- **PR-2.4 done:** `withLatheBody` — round mains = outline half-width per row (24 rows + poles), resized round, filler dropped. Tree 89 → 99 (IoU/edge 0.99); lamp 87 → 89 (ΔE 7.4); mean 93. Budget fix: allocation-free `clipLathe` (render 132 → 32 ms, pixels identical).
- Then PR-2.4 tree envelope → PR-2.13, PR-0.6, S4 bet. Free placement PP-T1…T8. PV-T14 + PV-T11b.

## Decisions taken

- Slab yields to plates (notch to old box top when straddling) and wheels (wells up to wheel tops); yaw gate 0.26 rad + feasibility bail.
- fit.iou re-scored after profiling (shipped silhouette ≠ fitted template); silhouetteRings largest-first reused, no duplication.
- Scenario V70 added (visible car-shape change).
- Plan refined from archi workflow (2026-11-01): target pipeline + skills map in PV-shape-realism.md; new PR-0.8, PR-2.14–2.16; Blender/GLB/VGGT out.
- Scene/status/parametric rules adopted: unified 4 statuses, PR-2.17 real openings, PR-2.18 `applyEdit`; LLM = params only, engine builds all geometry.

## Files touched this session

- New: `server/perception/mask-chimney.ts`, `__tests__/mask-chimney.test.ts`.
- `server/perception/object-shape.ts` (wire chimney pass + log), `docs/tasks/PV-shape-realism.md` (tick + log).
- `test-scenarios/06-village.md` (V71 chimney, gitignored).
