# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-02 (PP-T7 done, PP-T8 next) · **By:** Muse Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Standing: commit each task, unsigned fallback (`-c commit.gpgsign=false`), always continue.
- **PP-T7 done:** prompt rule 2b (EN/FR/MG) — report the feeder, never invent x/z; tools forward
  appliance patches verbatim. Prompt-locale + passthrough tests green.
- Verify: typecheck ✓, lint 0 errors, prompt+tools 26/26. No Meta key in env — live-model check skipped.
- Left uncommitted: `generated_images/` (only a 0-byte tooling `.lock`, no content).

## Next task

- **PP-T8 Docs + scenarios** (`docs/tasks/PV-free-placement.md`): `screens/village.md`, `components.md`,
  i18n keys ×3, `test-scenarios/06-village.md` (place, override feeder, drag, mobile, dark/light), README line.
- Then PV-T11b + PV-T14. PR-0.5 needs 10 USER photos.

## Decisions taken

- No new copilot tool and no `appliances` in tool JSON schemas: the model must not author positions.
- No eval case for non-invention: mock-provider canned text can't prove the real model won't invent.

## Open questions / blockers

- Peer heads-up messaging failed (`unsupported_intent` on that route) — peer may not know their work was committed.
- SAM outline missed twice in PV-T9c probes (transient?); non-fatal by design.

## Files touched this session

- `server/copilot/prompt.ts` + `__tests__/{prompt,tools}.test.ts`, `docs/{copilot.md,tasks/PV-free-placement.md}`.

## Gotchas

- `pnpm --filter web test -- <path>` does NOT filter (runs all files); use `pnpm exec vitest run <path>` in `apps/web`.
- `make format-changed` formats the whole dirty tree incl. others' files — prettier own files only.
