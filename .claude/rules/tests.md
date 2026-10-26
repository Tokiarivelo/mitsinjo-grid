---
paths:
  - '**/__tests__/**'
  - '**/*.test.ts'
  - '**/*.test.tsx'
  - 'apps/web/e2e/**'
---

# Test rules

- Vitest + Testing Library. Query by role/label, not test ids, unless no accessible name exists.
- Test behavior via public API (`@mitsinjo/engine`, hook return, rendered text). No snapshot tests of large trees.
- Engine: table-driven cases over all 5 scenarios; assert invariants and the demo-hero comparison.
- Hooks with store: reset store in `beforeEach` (`useSimulationStore.setState(initialState, true)`).
- E2E: single `demo-path.spec.ts`, `LLM_PROVIDER=mock`, deterministic; no `waitForTimeout`.
- Run only the affected package: `pnpm --filter <pkg> test -- <pattern>`; full suite before handoff.
