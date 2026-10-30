# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-30 · **By:** Claude Code · **Branch:** `feat/hardware-twin` · **PR:** #30

## State

- **PL-T17 done:** survival floor sliders in Strategy Lab (`StrategyRulesSection`): on/off button
  (`lifeline.enabled`) + 0–2 kW slider per connected sector (`lifeline.kw`); hidden + amber note when off.
- Plan `docs/tasks/PH-hardware-twin.md` (physical scale model; study `docs/maquette-physique.md`, FR):
  - **H1** engine: `solarProfile` patch, hardware Zod contracts, `scaleTelemetry`, `toHardwareCommand`.
  - **H2** engine `dispatch/`: breaker, controller mode, flow level, `feederTone` shared with web 3D/2D.
  - **H3** `apps/bridge`: `BridgeSession` (tested), embedded aedes MQTT broker, WebSocket, fake ESP32
    (`make bridge`, `make bridge-sim`, `make test-bridge`).
  - **H4-T1** web: `BridgeStateSchema` in engine; store `source` + `applyDeviceRun`/`releaseDevice`;
    `features/hardware-link` (`useHardwareLink`, `HardwareLinkPanel` in /simulation Controls tab, shown only
    when `NEXT_PUBLIC_BRIDGE_URL` is set). Verified live with bridge + fake device, dark/light, 1440 and 390 px.
  - `docs/bridge.md` (FR): settings + deploy § 8. **H8-T0** live speed buttons (default 20 s/h). **H8-T1** `?bridge=`
    link (tab session, `useBridgeTarget`). **H8-T2** `BRIDGE_TOKEN` (read-only without it), `MQTT_USERNAME/PASSWORD`.
- **Scrubber fluide:** `useSmoothScrub` (thumb continu, glisse en lecture, horloge live en suivi maquette via
  store `deviceHourMs`); boutons de lecture masqués quand `source === 'device'`. Guide env local/Vercel: `docs/setup/env.md`.
- Checks: engine 202 ✓, bridge 21 ✓, web 459 ✓, typecheck ✓, lint ✓, i18n ✓, prettier ✓. Pre-existing: `sweep.test.ts`
  perf budget fails under `make check` (parallel packages), passes alone; also on clean `main`.

## Next task

- PR #30 merged. Then H5 (hardware build + ESP32 firmware), H4-T2 (calibration panel).

## Decisions taken

- Scale 1 W = 4 kW, 1 h = 20 s (live 60/20/10/5); displayed SoC always engine output; model battery = buffer only.
- Bridge sends scenario + patch + strategy + hour; the web re-runs the engine (numbers never taken from the bridge).
- Scrubber: store still gets whole hours; only the thumb is fractional (no extra engine/3D re-renders).
- Panel hidden unless `?bridge=` link or `NEXT_PUBLIC_BRIDGE_URL`; bridge never on Vercel (needs a permanent process). Follow stops on "Stop following" / scenario load.

## Files touched this session

- Engine: `schemas/{common,input,index,hardware}.ts`, `patch.ts`, `index.ts`, `dispatch/`, `hardware/`, tests
- Bridge: `apps/bridge/**` (new, `access.ts`) · `pnpm-lock.yaml`
- Web: `features/microgrid-3d/{types,utils/*}`, `features/strategy-lab/{ui/strategy-rules-section.tsx,__tests__}`,
  `features/hardware-link/**`, `features/simulation/ui/simulation-page.tsx`, `stores/simulation.store.ts`,
  `lib/env.ts`, `messages/{en,fr,mg}.json`, `features/simulation/{hooks/use-smooth-scrub.ts,ui/*}`, `stores/selectors.ts`
- Docs/tooling: `maquette-physique.md`, `contracts.md`, `engine-spec.md`, `architecture.md`, `design/{stitch-map,
screens/strategy-lab,screens/live-simulation}.md`, `tasks/*`, `setup/env.md`, `README.md`, `.env.example`, `Makefile`
