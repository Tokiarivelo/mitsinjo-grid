# PW — WebGL context leak: 3D scene flashes white during playback (bug)

**Read first:** `.claude/rules/three.md`, `docs/performance.md` § 5

## Symptom

- `/simulation`, run any scenario (e.g. « Référence 24h Nominale ») and let the timeline play:
  the 3D scene flashes white or blank (in-scene HTML labels stay), then comes back.
- Console: `WARNING: Too many active WebGL contexts. Oldest context will be lost.`, then
  `INVALID_OPERATION: delete: object does not belong to this context`.
- Both quality tiers. Seen on `main` (before and after the render-loop perf work), so not a
  regression of it. `/overview` is mostly spared (no automatic playback).

## Measured (2026-10-29, Chromium + SwiftShader, `?quality=low`)

| Moment                        | `getContext('webgl*')` calls | "Too many contexts" warnings |
| ----------------------------- | ---------------------------- | ---------------------------- |
| Page loaded, idle 3 s         | 9                            | 0                            |
| After 12 s of playback (19 h) | 37                           | 17                           |

Expected: 2 (the R3F canvas + the one-off software-renderer probe, which releases its context).
Chromium keeps ~16 live contexts; past that it kills the **oldest one, which is the scene**.

## Root cause (confirmed)

`hooks/use-webgl-available.ts` passes `isWebGLAvailable` as `getSnapshot` to
`useSyncExternalStore`. React calls `getSnapshot` on **every render** (twice in dev), and
`utils/webgl.ts#isWebGLAvailable` creates a new `<canvas>` + WebGL context each time and never
releases it. `features/simulation/ui/village-viewport.tsx` re-renders on every timeline step
(`timeIndex`), so playback leaks about 2 contexts per hour step.
Same hook in `features/overview/ui/grid-schematic-preview.tsx` (leaks on each hour change).

## Tasks

- [x] **PW-T1** Confirm: count `HTMLCanvasElement.prototype.getContext` calls for `webgl*` during
      playback (Playwright `addInitScript`). **Done when** the count grows with renders on `main`.
- [x] **PW-T2** Fix `isWebGLAvailable`: probe once and cache the result (like `isSoftwareRenderer`),
      release the probe context (`WEBGL_lose_context`). `useSyncExternalStore` then gets a cheap,
      stable snapshot. **Done when** a Vitest test proves repeated calls create one context at most.
- [x] **PW-T3** Merge the two probes (`isWebGLAvailable`, `detectSoftwareRenderer`) into one cached
      detection so the page opens a single throwaway context. Reuse, don't duplicate.
- [x] **PW-T4** Handle a lost context gracefully: listen to `webglcontextlost` on the R3F canvas
      → show the 3D placeholder instead of a white box, then remount the canvas (fresh context).
      **Done when** forcing `loseContext()` in devtools shows the fallback, not white.
- [x] **PW-T5** Regression check: add the context count to `scripts/scene-audit.mjs` (fail if > 3
      after playback) so `make scene-audit` catches a new leak.

## Result (2026-10-29)

- One cached probe (`utils/webgl.ts#getWebGLSupport`), context released: 2 WebGL contexts at load,
  still 2 after 12 s of playback, zero warning (`make scene-audit` prints the count, budget ≤ 3).
- `hooks/use-context-loss.ts`: a real loss shows the 3D placeholder and remounts the canvas
  (max 3 times). The loss R3F forces when it unmounts a canvas (tier switch, navigation) is
  ignored: reacting to it remounted in a loop and left the placeholder stuck.

## Exit criteria

- 12 s of playback on `/simulation`: ≤ 3 WebGL contexts created, zero "Too many active WebGL
  contexts" warning, no white frame (`make scene-audit` both tiers + manual run).
- Manual scenarios added in `test-scenarios/02-simulation.md` (playback, no white flash).
- `make check` green; `docs/performance.md` § 5 notes the single cached WebGL probe.
