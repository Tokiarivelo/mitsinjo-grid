---
name: verify
description: Run the cheapest sufficient checks for what changed (typecheck, lint, tests) and report only failures. Use after edits and before handoff.
---

1. `git status --porcelain` → map changed paths to packages (`packages/engine` → `@mitsinjo/engine`, `apps/web` → `web`).
2. Prefer Makefile targets (`make test-engine`, `make test-web`, `make check`). Otherwise per package:
   `pnpm --filter <pkg> typecheck && pnpm --filter <pkg> lint && pnpm --filter <pkg> test`.
   Engine changed → also run web tests (consumer).
3. Pipe output through `tail -40`; on failure re-run only the failing test file with `-- <path>`.
4. Report: ✅ list of passing checks in one line, then each failure with file:line and a one-line cause.
5. E2E (`pnpm --filter web test:e2e`) only when routes, store, or copilot stream changed, or before handoff of P4+.
