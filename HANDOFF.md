# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-02 (PP-T6 done, PP-T7 next) · **By:** Muse Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Standing: commit each task, unsigned fallback (`-c commit.gpgsign=false`), always continue.
- **PP-T6 done (no code change):** `aiDraft` already suggests the sector with `position: null` → ring;
  draft+placement+markers suites 29/29 green. Photo-box → position stays out of scope.
- Previous: critic-retry crash fixed (`eca9f2b`), R2 upload timeout (`e56ce2a`), setup docs (`eed3c21`).
- Left uncommitted: `generated_images/` (only a 0-byte tooling `.lock`, no content).

## Next task

- **PP-T7 Copilot** (`docs/tasks/PV-free-placement.md`): tools report the feeder, never invent positions;
  `position` passes through unchanged.
- Then PP-T8 (docs + scenarios), PV-T11b + PV-T14. PR-0.5 needs 10 USER photos.

## Decisions taken

- Paid-for critic round always completes (retry has no Spark call); ≥20 s gate guards round START only.
- `Math.max(0, timeoutMs)` clamp stays as the construction guard; `remainingMs` may be ≤ 0 by design now.

## Open questions / blockers

- Peer heads-up messaging failed (`unsupported_intent` on that route) — peer may not know their work was committed.
- SAM outline missed twice in PV-T9c probes (transient?); non-fatal by design.

## Files touched this session

- `docs/tasks/PV-free-placement.md` (PP-T6 ticked, no code change).
- Earlier: `server/perception/{object-shape.ts,spark-critic.ts}` + 2 test files; peer media + setup docs committed.

## Gotchas

- `pnpm --filter web test -- <path>` does NOT filter (runs all files); use `pnpm exec vitest run <path>` in `apps/web`.
- `make format-changed` formats the whole dirty tree incl. others' files — prettier own files only.
