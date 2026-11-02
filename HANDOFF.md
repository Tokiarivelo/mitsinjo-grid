# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-02 (PA-T2 complete) · **By:** Antigravity · **Branch:** current

## State

- **AI autonomous dispatch decision policy (PA-T2) complete**:
  - `candidateActions(incident, input)` (PA-T2a): covers isolate, cap, shed flexible, switch strategy (`essential_first`, `balanced`, `proportional`), raise clinic floor, reserve night, shift flexible, restore.
  - `simulateHorizon(input, strategy, startHour, endHour, initialStoredKwh)`: fast forward lookahead ($h..h+6$) anchored to true battery energy entering hour $h$.
  - `checkAntiOscillation(action, hour, day, history)` (PA-T2c): max 2 actions/h, no reversal in 2h, safety fire isolation exception.
  - `decideDispatch(input, hour, strategy, incidents, rules, history, day)` (PA-T2b): evaluates candidates, drops constitution violations, never restores burning sector, selects best outcome.
  - Acceptance criterion met on all 7 scenarios: AI mode critical unserved $\le$ best fixed strategy (and beats it on `battery_constraint` & `essential_stress`).
  - Average latency ~5.9 ms / hour (< 20 ms budget).
  - Contracts in `docs/contracts.md`, tasks checked in `docs/tasks/PA-ai-dispatch.md`.
  - Tests in `packages/engine/src/__tests__/autonomy.test.ts`: 28/28 passed. Total engine tests: 327/327 passed across 25 files.
- **Quality & Verification**:
  - `pnpm --filter web typecheck`: 0 errors.
  - `make test-engine`: 25/25 files passed (327/327 tests).
  - `make check-i18n`: 100% key parity (en, fr, mg).

## Next task

- **PA-3** (`docs/tasks/PA-ai-dispatch.md`): Orchestrateur et store
  - PA-T3a: Store `dispatchMode`, `dispatchLog`, `setDispatchMode`, `takeBackControl` (→ manual). Neon table `dispatch_log` via `server/db/migrations.ts`.
  - PA-T3b: Hook `useAiDispatch` (remplace `useAutopilot`) : à chaque heure simulée en mode autonome → détecter → décider → appliquer → journaliser.

## Parallel session (Claude) — 3D by script, plan PV-G (`docs/tasks/PV-shape-script.md`)

- G0 + G1 done (6f57587, 1774910): elevation score vs the 2D drawing (`elevation-score.ts`, log `[vision] 3D elevation n/100`),
  drawn `partMaterials`, vetted swatches, slope UVs, framed windows/doors (`vision-insert/utils/openings.ts`), brick/stone colours.
- Thatched golden 89/100 (openings 3/3). Next: G2 (PG-T10 assemblies, PG-T11 wall cuts). Live check: V96–V98.
