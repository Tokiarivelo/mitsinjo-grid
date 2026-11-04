# tests/ — cross-package integration tests

Unit tests live next to their code (`packages/engine/src/__tests__`, `apps/web/src/**/__tests__`,
Playwright in `apps/web/e2e`). This folder holds tests that span packages or check repo-level claims.

| File                             | Checks                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `integration/benchmarks.test.ts` | `benchmarks/engine.json` (quoted in the README) still matches what the engine computes |

Run: `make test-integration` (also part of `make test` and CI). After an engine change that moves a
number, re-run `make bench` and commit the new `benchmarks/engine.json`.
