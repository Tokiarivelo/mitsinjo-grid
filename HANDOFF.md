# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-01 (PR-0.4 machinery, Meta outage, S2 next) · **By:** Muse Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- `18f20a4` committed (PR-0.7, unsigned: sandbox blocks GPG). Tree has PR-0.4 machinery uncommitted.
- **PR-0.4 machinery done, box open:** `shape-capture.ts` (`onKit` hook, `cropRectForShape`, remap, write/read/`rescoreCapture`), `make shape-capture PHOTO=… ID=…`, fixtures in gitignored `__fixtures__/shape/real/`. Unit tests green (round-trip + offline rescore iou > 0.6).
- **Meta outage 2026-11-01:** SAM aborts, Spark > 150 s (5 attempts, capture refuses mock/silhouette correctly). No live fixture yet; re-run when Meta is back. PR-0.5/PR-0.6-live also blocked on this.
- Scores unchanged (crop refactor is behaviour-identical, `test-shape` 5/5).

## Next task

- **Commit** PR-0.4 machinery, then **S2 shape (no live dependency, attacks « toy look »)**: `docs/tasks/PV-shape-realism.md` → **PR-2.1 `extrude`** (polygon slab + bevel, raster support) then **PR-2.2 profile body** (SAM outline extruded for vehicle/cabinet/machine).
- Then S2 rest (lathe, part masks, wheels/windows, fit v2), PR-0.6 Spark critic, S4 bet.
- **Free placement**: `docs/tasks/PV-free-placement.md` (PP-T1…T8). **PV-T14** + **PV-T11b**.

## Decisions taken

- Capture refuses mock/silhouette (a fixture must be a real recipe); live runner gets 150 s (routes keep 60 s).
- `cropRectForShape` pure in `shape-crop.ts`, `cropForShape` delegates (identical bytes, proven by test).
- Fixture = `<id>.capture.json` (target, kit, recipe, remapped cropTarget, empty partMasks slot) + `<id>.crop.jpg` (exact bytes Spark saw).
- `__fixtures__/shape/real/` gitignored (user photos, plan-anticipated); report skips missing ones.

## Files touched this session

- New: `server/perception/shape-capture.ts`, `__tests__/shape-capture.test.ts`.
- `server/perception/object-shape.ts` (`onKit`), `server/perception/shape-crop.ts` (rect refactor).
- `Makefile` (`shape-capture`), `.gitignore` (real/), `docs/tasks/PV-shape-realism.md` (PR-0.4 note).
