# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-27 · **By:** Antigravity (PX & PY phases) + Claude (PR #15 review) · **Branch:** `feat/px-py-phases`

## State

- Phases: **PX (Anomaly signal)** and **PY (Sector control proposals)** completed.
- PX: Engine `meterReadings` override + `ANOMALY_TO_VERIFY` detector (>25% gap, ≥2h). Synthetic `meter_anomaly` scenario.
- PY: Engine `sectorCaps` + iterative water-filling reallocation, `SECTOR_CAPPED` warning, `served_s ≤ cap_s + ε` invariant.
- Copilot: `propose_change` supports `priorities` & `sectorCaps`; prompt ensures trade-off proposals, never physical control.
- UI: ConfirmProposalDialog shows diffs, SimControls & AssumptionsInspector show active caps/priorities, 100% i18n EN/FR/MG parity.
- Monorepo healthy: `make check` 100% green (typecheck, lint, test), `pnpm build` clean.

## Next task

- PR #15 reviewed, fixed and merged. Next: run `make shots` to screenshot-check PX/PY UI (not done in review).

## Decisions taken

- Empty/absent `sectorCaps` preserves canonical JSON hash and ID (byte-identical results).
- Expected demand computed once (`computeProfileDemandKw`), shared by simulate and the anomaly detector.
- Strict warning wording: "anomaly to verify" only, never "fraud" or "theft".
- Caps and priorities presented strictly as simulated trade-offs and social choices.

## Open questions / blockers

- None.

## Files touched this session

- Engine: `schemas/`, `model/demand.ts`, `simulate.ts`, `invariants.ts`, `warnings.ts`, `patch.ts`, `hash.ts`, `scenarios/`
- Web: `server/copilot/`, `features/scenarios/`, `features/simulation/`, `features/copilot/`, `components/`, `messages/`
- Docs: `docs/engine-spec.md`, `docs/contracts.md`, `docs/tasks/PX-anomaly.md`, `docs/tasks/PY-sector-control.md`, `HANDOFF.md`, `docs/copilot.md` (eval 10–11), `docs/design/stitch-map.md`, `README.md`
