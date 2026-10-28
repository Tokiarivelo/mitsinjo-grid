# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-28 · **By:** Antigravity (simulation playback play/pause/stop/restart) · **Branch:** `feat/simulation-playback-controls`

## State

- Simulation playback controls unified in `useSimulationStore`: `isPlaying`, `playbackStatus`, `play`, `pause`, `stop`, `restart`, `togglePlay`.
- Clicking "Lancer la simulation" runs calculation and transitions button status dynamically into active playback (Pause).
- Stop (rewinds to 00:00) and Restart (rewinds to 00:00 and plays) controls added across top header, `SimControlsPanel`, and `TimelineScrubber`.
- StatusBadge dynamically displays `SIMULATING` during active playback, `SIMULATION COMPLETE` when paused/stopped, and `SCENARIO MODIFIED` on changes.
- 100% key parity across `en.json`, `fr.json`, and `mg.json` for all new playback labels and action titles.
- Checks green: typecheck, lint, format-check, 102 engine tests, 246 web tests (all passing).

## Next task

- Run `make e2e` and `make shots` for visual and full regression validation, then merge.

## Decisions taken

- Playback state is held centrally in `useSimulationStore` with narrow selectors so header, controls panel, and 24h scrubber remain in sync.
- Auto-advance interval is driven centrally via React effect on `/simulation` and disengaged on unmount/manual scrubbing.

## Open questions / blockers

- None.

## Files touched this session

- Store: `apps/web/src/stores/simulation.store.ts`, `selectors.ts`, `__tests__/simulation-store.test.ts`
- UI: `apps/web/src/features/simulation/ui/{simulation-page.tsx, sim-controls-panel.tsx, timeline-scrubber.tsx}`, `__tests__/simulation.test.tsx`
- i18n: `apps/web/src/messages/{en.json, fr.json, mg.json}`
- Docs: `HANDOFF.md`
