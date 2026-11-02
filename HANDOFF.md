# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-02 (PP-T8 done, PV-free-placement complete, PV-T11b next) · **By:** Muse Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Standing: commit each task, unsigned fallback (`-c commit.gpgsign=false`), always continue.
- **PP-T8 done:** village.md + components.md updated, 11 placement keys verified ×3, scenarios V79–V84
  appended (gitignored), README line extended. Whole free-placement plan ✅ done.
- Verify: `make check-i18n` 3/3 green (docs-only turn, no code change).
- Left uncommitted: `generated_images/` (only a 0-byte tooling `.lock`, no content).

## Next task

- **PV-T11b + PV-T14** (`docs/tasks/PV-vision-insert.md` — read it next; free-placement plan is closed).
- Then PR-0.5 (needs 10 USER photos). S4 stopped.

## Decisions taken

- No eval case for copilot non-invention: mock canned text can't prove the real model won't invent.
- Paid-for critic round always completes (retry has no Spark call); ≥20 s gate guards round START only.

## Open questions / blockers

- Peer heads-up messaging failed (`unsupported_intent` on that route) — peer may not know their work was committed.
- SAM outline missed twice in PV-T9c probes (transient?); non-fatal by design.

## Files touched this session

- `docs/{design/screens/village.md,design/components.md,tasks/PV-free-placement.md}`, `README.md`,
  `test-scenarios/06-village.md` (V79–V84, gitignored, stays local).

## Gotchas

- `pnpm --filter web test -- <path>` does NOT filter (runs all files); use `pnpm exec vitest run <path>` in `apps/web`.
- `make format-changed` formats the whole dirty tree incl. others' files — prettier own files only.
