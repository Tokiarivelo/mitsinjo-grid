# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-29 · **By:** Claude Code · **Branch:** `perf/scene-3d-render-loop` (uncommitted: gpg signing fails)

## State

- 3D perf: ambient animation capped at 30 fps (`useAmbientFrame`), loop paused off-screen, shadow map baked
  (`ShadowBake`), HDRI 512 (`sunset_512.hdr`). High steady frame 294 → ~206–252 draw calls.
- PW (WebGL context leak, white flash) ✅: one cached probe, 2 contexts after playback, context-loss recovery.
- Low-tier budget: houses merged (`utils/house-geometry`), low vegetation 520 trees → 129 calls / 117 k tris.
- PS (sector socle) ✅: `SECTOR_IDS`, `loadMultiplier`, `InputPatch.sectorLoads`, `industry` sector (small
  factory, disconnected by default), `SectorLoadPanel` on `/simulation` (Buildings tab), copilot patch prop.
- Engine 0.3.0, 173 tests; web 399 tests; i18n parity OK; `make scene-audit` low ✓, high /simulation ✓.
  Under heavy load some timing tests and the high /overview audit time out; they pass alone.

## Next task

- Commit (proposed split): `perf(3d)` render loop · `fix(3d)` PW context leak · `perf(3d)` low-tier budget ·
  `feat(engine,web)` sector socle + factory + live load. Needs gpg fixed or user OK to commit unsigned.
- Then PL phase 2/3 (`docs/tasks/PL-lifeline-dispatch.md`).

## Decisions taken

- `loadMultiplier 0` = not connected: hidden from overview, strategy cards, coverage, metrics bars; still
  listed in the Buildings tab so it can be connected. Value 1 is stored as absent (hash unchanged).
- Factory placed north-east behind the clinic `[11, 0, -8.5]` (visible in the default Village camera).
- MG translations of `sectorLoad.*` and `industry` need a native-speaker check.
- Adding a sector: checklist in `docs/engine-spec.md` § 6 (exhaustive `Record<SectorId,…>` fail typecheck).

## Files touched this session

- Engine: `schemas/{common,input}.ts`, `model/{demand,sectors,index}.ts`, `patch.ts`, `constants.ts`,
  `metrics/calculate.ts`, `scenarios/baseline.ts`, tests (`sector-load.test.ts` …).
- Web: `features/microgrid-3d/**` (render loop, webgl, context loss, house geometry, factory, layouts),
  `features/simulation/{hooks/use-sector-loads,ui/sector-load-panel,ui/simulation-page}`, overview,
  strategy-lab, charts, copilot tools, messages en/fr/mg, `scripts/scene-audit.mjs`, `public/3d`.
- Docs: contracts, engine-spec, copilot, performance, design/3d-scene, tasks (PW, PS, README), README, three rule.
