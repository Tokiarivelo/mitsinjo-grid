# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-02 (PP-T5 done, PP-T6 next) · **By:** Muse Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Committed through PP-T5 (see log); standing: commit each task, unsigned fallback (`-c commit.gpgsign=false`), always continue.
- **PP-T5 done:** `useMarkerDrag`+`useMoveMarker` wired via `DraggableApplianceMarkers` in `village-canvas.tsx`
  (/village, /simulation, overview preview); ring + cyan tag, hidden drag instance, `MarkerDragGhost`.
- Also committed: `fix(web)` mock `describeParts` signature (`a97fd53`) — was red on `e7ce336`, pre-existing.
- Verify: typecheck ✓, lint 0 errors, PP-T5 suites ✓ (7+4+1+15+7), model-score flake under load only (10/10 solo).
- **NOT MINE (never commit):** `server/storage/media.*`, `docs/setup/*.md`, `server/perception/object-shape.ts`
  (`.bind` fix appeared 10:33 from concurrent session), `generated_images/`.

## Next task

- **PP-T6 AI suggestion** (`docs/tasks/PV-free-placement.md`): `aiDraft` sector suggestion; position default = ring.
  Photo-box → position mapping stays out of scope (no camera calibration).
- Then PP-T7 (copilot feeder reporting), PP-T8 (docs + scenarios), PV-T11b + PV-T14. PR-0.5 needs 10 USER photos.

## Decisions taken

- Drag always-on in `VillageCanvas` (no prop): all three canvas users share the wiring + input store.
- `controls`/`onCommit`/`onActiveChange` reach the drag listeners via refs-in-effects (react-hooks/refs clean).
- Pre-existing red typecheck fixed as separate `fix(web)` commit, never inside the feature commit.

## Open questions / blockers

- Concurrent agent active in this worktree — check `git status` before every commit, name files explicitly.
- SAM outline missed twice in PV-T9c probes (transient?); non-fatal by design.

## Files touched this session

- `microgrid-3d/{hooks/use-marker-drag.ts,hooks/use-move-marker.ts,ui/appliance-markers.tsx,ui/village-canvas.tsx,
utils/placement.ts}` + 4 test files (2 new hook suites, placement + markers-UI extended).
- `server/perception/mock.ts` (fix commit), `docs/tasks/PV-free-placement.md` (PP-T5 ticked).

## Gotchas

- `pnpm --filter web test -- <path>` does NOT filter (runs all 178 files); use `pnpm exec vitest run <path>` in `apps/web`.
- `make format-changed` formats the whole dirty tree incl. others' files — prettier own files only.
