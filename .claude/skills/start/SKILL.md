---
name: start
description: Begin a work session on Mitsinjo Grid — load HANDOFF.md and the single current task file, then state the plan. Use at the start of every session or when asked "what's next".
---

1. Read `HANDOFF.md`. Read only the task file it names (`docs/tasks/Pn-*.md`).
2. Load docs listed in that task's **Read first** — nothing else. Never load root `Mitsinjo_Grid_*.md`.
3. Pick the first unchecked task ID. If it is marked (human), say so and pick the next agent task.
4. Reply in ≤ 5 lines: task ID, files you expect to touch, how you'll verify. Then start.
5. Locate code with `rg -n`/glob; read barrels (`index.ts`) before internals; read ranges, not whole large files.
