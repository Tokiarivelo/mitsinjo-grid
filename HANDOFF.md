# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-28 · **By:** Antigravity (fix simulation controls validation) · **Branch:** `fix/simulation-controls-validation`

## State

- Fixed dropExceedsHorizon error synchronization and draft control recovery in `SimControlsPanel`.
- Sliders track draft values so compensating parameters (e.g., reducing duration after start exceeds 24h) correctly clear errors.
- Added reset scenario handling to wipe error state and restore initial drop values.
- All checks green: typecheck, lint, 99 engine tests, 243 web tests, 100% i18n key parity.

## Next task

- Merge PR into `main` and run `make e2e` & `make shots` for dual themes and mobile viewports.

## Decisions taken

- `SimControlsPanel` holds local draft state for `dropStartHour` and `dropDurationH` to allow user correction when in an invalid composite state.
- `validatePatch` clears errors when `solarDropPct` is set to 0.
- Reset button remains active when horizon errors exist to allow quick recovery.

## Open questions / blockers

- Overview `sheddingProtocolDesc` ("below 20%") + two different site coordinates: static claims, confirm or remove.

## Files touched this session

- `apps/web/src/features/simulation/ui/sim-controls-panel.tsx`
- `apps/web/src/features/simulation/utils/validate-patch.ts`
- `apps/web/src/features/simulation/__tests__/simulation.test.tsx`
- `HANDOFF.md`
