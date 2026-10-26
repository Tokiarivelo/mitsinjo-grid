# P3 — Engine (Days 2–3)

**Read first:** `docs/contracts.md` · `docs/engine-spec.md`
**Goal:** deterministic, tested source of every number. No UI.

- [ ] **P3-T1** Zod schemas + inferred types (`schemas/`), `parseInput`, bounds from contracts.
- [ ] **P3-T2** `model/`: solar profile + events, demand profiles + events, battery step (charge/discharge/eff/reserve).
- [ ] **P3-T3** `strategies/proportional.ts` + tests.
- [ ] **P3-T4** `strategies/essential-first.ts` + tests.
- [ ] **P3-T5** `simulate.ts` step loop + invariant checker (`violations`) + `metrics/` + `warnings`.
- [ ] **P3-T6** `hash.ts` (canonical JSON → FNV-1a/sha-like hex, no crypto dep needed), result `id`.
- [ ] **P3-T7** `scenarios/` 5 presets; `compare.ts`; `applyPatch` (InputPatch → input).
- [ ] **P3-T8** Test suite from engine-spec §7, incl. the demo-hero test (proportional leaves critical unserved, essential_first doesn't).
- [ ] **P3-T9** (stretch) `strategies/balanced.ts` + tests.

**Exit criteria:** `pnpm --filter @mitsinjo/engine test` green, coverage ≥ 90 %, `violations = 0` on all scenarios, `compare()` < 10 ms.
