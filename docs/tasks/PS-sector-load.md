# PS — Sector socle: live sector load + small factory

**Read first:** `docs/engine-spec.md` § 6 (Live sector load, Adding a consumer sector), `docs/contracts.md`

Goal (demo): add a consumer (e.g. a factory) or change a sector's load live and watch the simulation follow.

## Tasks

- [x] **PS-T1** Engine: `SECTOR_IDS` single source; `SectorConfig.loadMultiplier` (0–3, 0 = not connected);
      `InputPatch.sectorLoads`; `connectedSectors` helpers; `ENGINE_VERSION 0.3.0`. Tests `sector-load.test.ts`.
- [x] **PS-T2** `industry` sector (small factory, ≈ 8 kW by day), disconnected by default: demo numbers unchanged.
- [x] **PS-T3** Web: exhaustive `Record<SectorId, …>` tables (3D position, keep-out, icon, diagram box/wire,
      body layout) so a new id fails typecheck until placed. Factory body (merged hall + chimney + silo).
- [x] **PS-T4** `/simulation` Buildings tab: `SectorLoadPanel` (slider ×0–3 + connect/disconnect) →
      `applyProposal({ sectorLoads })`, immediate re-run, playback kept. Hook `use-sector-loads` tested.
- [x] **PS-T5** Disconnected sector: 3D `disconnected` status, hidden from overview, strategy cards, coverage.
- [x] **PS-T6** Copilot tools accept `patch.sectorLoads` (run_scenario, propose_change).

## Exit criteria

- `make check` green; `make scene-audit` both tiers within budget with the factory connected.
- Manual scenarios in `test-scenarios/02-simulation.md`.
