---
name: engine-change
description: Add or change engine behaviour (strategy, metric, warning, scenario, input field) in packages/engine with contract-first discipline. Use for any work in packages/engine.
---

Read `docs/contracts.md` and the relevant section of `docs/engine-spec.md` only.

1. **Contract first:** if a shape changes, edit `docs/contracts.md` + Zod schema in `src/schemas/`.
2. **Test first:** add failing cases in `src/__tests__/<area>.test.ts` (table-driven over scenarios + invariants).
3. Implement in the right folder: `model/` physics · `strategies/` allocation · `metrics/` aggregation · `scenarios/` presets.
4. New strategy: implement `(ctx: StepCtx) => Record<SectorId, number>`, register in `strategies/index.ts` + `STRATEGIES` label/rule.
5. Export via `src/index.ts`. Bump `engineVersion` on behaviour change.
6. `/verify` engine + web. Check `violations === 0` on all scenarios and `compare()` < 10 ms (bench test).
