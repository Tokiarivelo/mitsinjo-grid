---
paths:
  - 'packages/engine/**'
---

# Engine rules

- Pure TS. Allowed deps: `zod` only. No React, DOM, fetch, `process.env`, `Date.now()`, unseeded `Math.random`.
- Types come from Zod schemas (`z.infer`); never hand-write a duplicate interface. Contract: `docs/contracts.md`.
- Pure functions, no mutation of inputs (`structuredClone` or spread). Same input → byte-identical output.
- No rounding in the engine; UI formats. Use `EPS = 1e-9` for float comparisons.
- Every step runs the invariant checker; violations counted in `metrics.violations`, never thrown in prod.
- Public API only through `src/index.ts`. Changing an exported shape = update `docs/contracts.md` in the same commit.
- Each new function ships with a test in `src/__tests__/`. Hot path (`simulate`) stays allocation-light: preallocate arrays of length 24.
