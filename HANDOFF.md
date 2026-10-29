# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-29 · **By:** Antigravity · **Branch:** `feat/lifeline-engine` · **PR:** [to create]

## State

- Plan `docs/tasks/PL-lifeline-dispatch.md`: **Phase 1 completed** (PL-T1…T4 done).
- PL-T1: `SectorConfig.lifelineKw`, `DEFAULT_LIFELINE_KW`, `SectorStep.lifelineServedKw`, `SectorStep.mode`, hash stability.
- PL-T2: Common Pass 0 across strategies (`strategies/lifeline.ts`), emergency mode (`dispo < Σ planchers`).
- PL-T3: Invariant `LIFELINE_MET`, warning `LIFELINE_SHORTFALL`, metric `lifelineCoveragePct`.
- PL-T4: `InputPatch.lifeline` (`enabled`, `kw`), `compareLifelineCoverage`.
- `make check` green (engine 151 tests, web 366 tests). 100% i18n key parity across EN/FR/MG.

## Next task

- Review & merge PR (PL phase 1 engine).
- Begin PL Phase 2 & 3: dispatch controller & intensity lighting in 2D & 3D (`docs/tasks/PL-lifeline-dispatch.md` PL-T5, PL-T9…T13).

## Decisions taken

- Default planchers: health 0.3 kW, water 0.2, school 0.1, households 0.4, market 0.1 (sum = 1.1 kW).
- Lifeline enabled by default: hash is stable when default is used; `lifeline.enabled = false` reverts to base allocations.
- Emergency mode (`dispo < Σ planchers`): water & health split available power equally; remaining surplus (if any) shared among others proportional to planchers; otherwise others are 0 kW (`mode = 'off'`).
- Sector caps priority: `cap < plancher` -> cap wins.

## Files touched this session

- Engine: `packages/engine/src/{constants,hash,invariants,patch,simulate,warnings,compare}.ts`, `src/schemas/*`, `src/strategies/*`, `src/__tests__/{lifeline,invariants,smoke}.test.ts`
- Web: `apps/web/src/features/strategy-lab/utils/__tests__/divergence.test.ts`
- Docs: `docs/contracts.md`, `docs/engine-spec.md`, `docs/tasks/PL-lifeline-dispatch.md`, `docs/tasks/README.md`
