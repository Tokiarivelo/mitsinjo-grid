# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-02 (FIX 1–3 + retry button done, investigation closed) · **By:** Muse Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Committed through PR-5.1/5.2 (`262e50c`). Uncommitted: FIX 1–3 + retry button + this handoff. Standing: commit each, unsigned fallback, always continue.
- **Toy-Mini investigation CLOSED** (docs/tasks/PV-shape-realism.md § Toy-Mini): live SAM probed on screenshot pixels — answers swing with pixels (tight 0.73 / merged 0.54 / empty); no-outline miss cascades fit→profile→colours→parts; imagined 6 views faithful (toy recipe in → toy views out); prompts OK, no prompt change proven.
- **FIX 1:** miss-cause warns (`outline missed…` / `part masks missed…`, per-concept). **FIX 2:** crop fallback for outline + `remapOutlineToPhoto` (full hit skips crop). **FIX 3:** wheels filter-then-cap. 10 new tests; shape-report identical (mean 93, IoU 0.98, edge 0.91, ΔE 3.4).
- **Retry button:** header ↻ in DetectionCanvas (« Relancer la détection », fr/en/mg, V78) — re-runs AI detection, keeps manual drawings, hidden while loading/editing. Gate-out by tokens (live screenshots blocked: sandbox kills Next dev + host unreachable).
- **Meta reachability:** user's dev logs show ETIMEDOUT → mock fallback; FIX 1 logs now expose that path.
- **NOT MINE:** `server/storage/media.ts` + test changed concurrently (upload timeout/inlineUrl) — leave for its author, do not commit.
- PR-0.5 still needs 10 USER photos. S4 stopped. Free placement PP-T1…T8, PV-T14 + PV-T11b open.

## Next task

- **Commit** FIX 1–3 + retry button (my files only, unsigned fallback), then continue to next planned task.
- Ask user for 10 photos (PR-0.5) alongside the investigation report.
- Known limits: merged-box outlines still adopted when full passes ≥0.3 (no full-vs-crop compare); topiary→vehicle prompt line latent (needs topiary fixture).

## Files touched this session

- `server/perception/outline.ts` (FIX 1+2), `part-masks.ts` (FIX 1), `mask-outline.ts` (remap), `mask-wheels.ts` (FIX 3), `object-shape.ts` (crop wire).
- `__tests__/outline|part-masks|mask-outline|mask-wheels.test.ts` (+10 tests).
- `features/vision-insert/ui/detection-canvas.tsx` + test, `messages/{fr,en,mg}.json` (retryDetection), `docs/tasks/PV-shape-realism.md`, `test-scenarios/06-village.md` V78 (ignored).
