# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-26 · **By:** Antigravity (P3 Core Engine + Strategies + Scenarios) · **Day:** 3 / 10

## State

- Phase: **P3 — Engine** completed (P3-T1..T9 done; 100% contracts & physics, 0 violations, demo hero verified).
- Prior phases complete: P0 Framing, P1 Repo & Tooling, P2 Design system & Strict Zero-Static i18n.
- Engine stats: 83 tests passing, 98.8% statement coverage (exit criteria ≥ 90%), `compare()` in ~3.4 ms (< 10 ms).
- Demo Hero verified: on `cloudy_afternoon`, `proportional` drops clinic critical power (`criticalUnservedKwh > 0`), whereas `essential_first` fully protects it (`criticalUnservedKwh === 0`, 100% critical coverage).
- All 5 scenarios verified with 0 invariant violations across all 3 strategies (`proportional`, `essential_first`, `balanced`).
- Monorepo healthy: `make check` (83 engine + 19 web tests = 102 passing) and `pnpm build` pass with 0 errors.
- PR: branch `feat/p3-engine` ready for merge into `main`.

## Next task

- `docs/tasks/P4-dashboard.md` → P4-T0 / P4-T1 (`simulation.store.ts` + `selectors.ts` wired to `@mitsinjo/engine`).

## Decisions taken

- Implemented pure TS deterministic simulation with FNV-1a 64-bit hashing for stable `inputHash` and `SIM-XXXXXX` IDs.
- Solar bell curve calibrated (≈5 peak-sun-hours, peakKw 40 kW) to guarantee 0 unserved on `baseline` and distinct evening deficit on `cloudy_afternoon`.
- Water-filling with priority weights (4, 3, 2, 1) implemented for stretch `balanced` strategy.
- Preallocated length-24 arrays in hot path `simulate()` for allocation-light performance.

## Open questions / blockers

- Meta API key / endpoint credentials for live Llama inference (offline mock ready as fallback for P6).

## Files touched this session

- `packages/engine/src/{index,constants,invariants,warnings,simulate,compare,patch,hash}.ts`
- `packages/engine/src/{schemas,model,strategies,metrics,scenarios}/**`
- `packages/engine/src/__tests__/{schemas,strategies,invariants,hash,patch,compare,scenarios,demo-hero,simulate,spec-invariants}.test.ts`
- `packages/engine/package.json`, `packages/engine/vitest.config.ts`, `docs/tasks/P3-engine.md`, `HANDOFF.md`
