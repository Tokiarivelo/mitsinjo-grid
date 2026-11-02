# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-02 (3D call logging done, PP-T7 next) · **By:** Muse Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Standing: commit each task, unsigned fallback (`-c commit.gpgsign=false`), always continue.
- **3D logging done:** `describeShape`/`describeParts`/`criticizeShape` log full request (params, image
  placeholder, schema, system + question) and result (model, usage, content); data URLs redact to
  `[image data-url, N chars]` (`vision-log.ts`, tested; detection/SAM calls stay quiet).
- Verify: typecheck ✓, lint 0 errors, vision-log 2/2 + meta 13/13 green.
- Left uncommitted: `generated_images/` (only a 0-byte tooling `.lock`, no content).

## Next task

- **PP-T7 Copilot** (`docs/tasks/PV-free-placement.md`): tools report the feeder, never invent positions;
  `position` passes through unchanged.
- Then PP-T8 (docs + scenarios), PV-T11b + PV-T14. PR-0.5 needs 10 USER photos.

## Decisions taken

- Paid-for critic round always completes (retry has no Spark call); ≥20 s gate guards round START only.
- Log redaction: `data:`-prefixed strings → placeholder (JSON replacer + text regex); http links log as-is.

## Open questions / blockers

- Peer heads-up messaging failed (`unsupported_intent` on that route) — peer may not know their work was committed.
- SAM outline missed twice in PV-T9c probes (transient?); non-fatal by design.

## Files touched this session

- `server/perception/{meta.ts,vision-log.ts}` + `__tests__/{vision-log.test.ts,meta.test.ts}`, `docs/copilot.md` (1 line).

## Gotchas

- `pnpm --filter web test -- <path>` does NOT filter (runs all files); use `pnpm exec vitest run <path>` in `apps/web`.
- `make format-changed` formats the whole dirty tree incl. others' files — prettier own files only.
