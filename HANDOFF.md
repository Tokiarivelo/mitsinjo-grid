# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-02 (PV-T11b done, PV-T14 next) · **By:** Muse Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Standing: commit each task, unsigned fallback (`-c commit.gpgsign=false`), always continue.
- **PV-T11b done (3 commits):** (1) 24 h engine-curve chart in insert panel; (2) viewer size+tint
  controls, visual-only, per object; (3) `edit_appliance` tool + dialog diff lines + per-line approval.
- Verify: typecheck ✓, lint 0 errors, i18n 3/3; suites green (insert 8, curve 1, display 2, panel,
  tools 24, eval 66, parts, diff, selection). Gate-out static only (sandbox blocks dev server).
- Left uncommitted: `generated_images/` (only a 0-byte tooling `.lock`, no content).

## Next task

- **PV-T14 Evals** (`docs/tasks/PV-vision-insert.md`): 10 scripted mock prompts incl. "why does water run
  out at 19 h" citing pump loads; Orange Money prefix +0.1r; anomalies stay signals-to-verify.
- Then PR-0.5 (needs 10 USER photos). S4 stopped.

## Decisions taken

- "scale/colour (visual only)" = viewer-local size slider + tint in the 3D block (no engine/storage touch).
- Appliance diff lines show feeder + load (+position when set); removals last; unchecked restores current.
- No `edit_appliance` prompt hint: the tool description carries the never-invent-positions rule.

## Open questions / blockers

- Live /village screenshots pending on the operator's machine (sandbox networking, see stitch-map note).
- Peer heads-up messaging failed (`unsupported_intent`) — peer may not know their work was committed.
- SAM outline missed twice in PV-T9c probes (transient?); non-fatal by design.

## Files touched this session

- Slices 1–3 committed separately; this commit: task tick + `screens/village.md` + `components.md` +
  `stitch-map.md` (gate note) + HANDOFF.

## Gotchas

- `pnpm --filter web test -- <path>` does NOT filter (runs all files); use `pnpm exec vitest run <path>` in `apps/web`.
- `make format-changed` formats the whole dirty tree incl. others' files — prettier own files only.
- Never `pkill -f` with a pattern inside your own command line (matches itself); exclude `$$`.
