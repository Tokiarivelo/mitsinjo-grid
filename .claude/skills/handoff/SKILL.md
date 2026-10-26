---
name: handoff
description: End a work session — verify, tick task boxes, and overwrite HANDOFF.md so another agent can continue cheaply. Use before stopping, when context is large, or when asked to hand off.
---

1. Run `/verify` (affected packages). Note failures; don't hide them.
2. Tick finished boxes in the current `docs/tasks/Pn-*.md`.
   Apply `.claude/rules/maintenance.md`: new commands are in the Makefile, changed features have their doc updated.
   Keep every still-valid line of the previous HANDOFF "Decisions" and "Gotchas" — never drop them.
3. Overwrite `HANDOFF.md` with this exact skeleton, ≤ 40 lines, facts only:

```markdown
# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** YYYY-MM-DD · **By:** <agent> · **Day:** n / 10

## State

- Phase / last task done / verify status (pass|fail + what)

## Next task

- `docs/tasks/Pn-*.md` → Pn-Tm (+ first concrete step)

## Decisions taken

- (keep previous ones that still hold; one line each)

## Open questions / blockers

## Files touched this session

## Gotchas
```

4. Don't paste code or logs into HANDOFF; reference paths and task IDs.
5. Suggest a commit message (conventional, with task ID). Commit only if the user asked.
