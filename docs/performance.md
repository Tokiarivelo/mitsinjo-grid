# Performance & fluidity

Goal: every interaction feels instant. The engine is cheap (< 10 ms), so slowness can only come from
React re-renders, chart redraws, 3D, or bundle size. Fix those before optimising math.

## 1. Budgets (checked in P8 with `/perf-audit`)

| Metric                                                | Budget                                          |
| ----------------------------------------------------- | ----------------------------------------------- |
| First-load JS per route (gz, excluding lazy 3D chunk) | ≤ 180 KB                                        |
| LCP /overview (desktop, prod build)                   | ≤ 2.0 s                                         |
| INP while dragging a slider                           | ≤ 100 ms                                        |
| `compare()` all strategies                            | ≤ 10 ms                                         |
| 3D frame rate on integrated GPU                       | ≥ 45 fps · draw calls ≤ 150 · triangles ≤ 150 k |
| Copilot first token visible                           | ≤ 2 s after send (activity shown at once)       |
| Lighthouse performance (desktop)                      | ≥ 90                                            |

## 2. Fluid slider → result loop

- Slider `onValueChange` updates a **local draft** (instant thumb); `onValueCommit` → `patchInput()` → `run()`.
  Optional live preview: throttle `run()` with `requestAnimationFrame` (one run per frame max).
- Wrap `run()` result commit in `startTransition` so input stays responsive while charts/3D update.
- No fake loading spinner: the engine is synchronous and instant; show `SIMULATION COMPLETE` directly.
- Engine stays on the main thread. Move it to a Web Worker only if the bench test exceeds 16 ms.

## 3. React rendering

- Zustand: narrow selectors per component; `useShallow` for multi-field reads; derived values in
  memoized selectors (`stores/selectors.ts`) — never recompute arrays inside render.
- Results are replaced immutably (new object per run) so selectors compare by reference.
- Split big screens into leaf components that each subscribe to their own slice.
- Enable React Compiler (`babel-plugin-react-compiler`, `experimental.reactCompiler`) to drop manual `memo`.
- Server Components for static parts (Scenarios descriptions, assumptions text, shell chrome).

## 4. Charts (Recharts)

- `isAnimationActive={false}` for data updated by sliders; animate only first mount.
- Data arrays built once per result in a selector (24 points — tiny); fixed `height`, `ResponsiveContainer` with `debounce={100}`.
- Lazy-load chart components per route with `next/dynamic` when below the fold.

## 5. 3D

Rules in `.claude/rules/three.md`. Key wins: `frameloop="demand"`, instancing, shared materials,
baked `ContactShadows`, `dpr={[1, 1.75]}`, Drei `<PerformanceMonitor>` to lower DPR on slow devices,
`<AdaptiveDpr pixelated />` during camera moves, lazy chunk via `next/dynamic({ ssr:false })`,
preload the chunk on sidebar hover of "Live Simulation".

Measure: add `?perf=1` to `/simulation` or `/overview` for a live draw-call / fps readout
(sampled at 2 Hz from `gl.info`). `make scene-audit` (server running) checks draw calls and
triangles against the budget and saves `design/shots/{simulation,overview}-3d.png`. It runs
headless Chromium on SwiftShader (software GL): draw calls and triangles are exact, fps is
not a GPU number. Check fps by hand on an integrated-GPU laptop with `?perf=1`.
In-scene `<Html>` labels take `portal` = a stable container ref so drei never re-targets
them after mount (re-targeting races React root unmounts and can leave a label empty).

## 6. Loading & navigation

- Fonts via `next/font` (self-hosted, `display: swap`, subsets latin) — no layout shift.
- Route `loading.tsx` with skeletons matching final layout (no CLS). `<Link prefetch>` default on.
- Store persists across routes (client store in root layout) → switching pages never re-runs simulation.
- Optional: persist last input in `localStorage` (try/catch) to restore the demo state on reload.

## 7. Copilot streaming

- SSE stream; render `activity` events immediately ("Running comparison…").
- Append deltas in a ref and flush to state once per animation frame (avoid per-token renders).
- Abort previous request on new send (`AbortController`); 20 s server budget; cache tool results by `inputHash`.

## 8. Build & deploy

- `next build` with Turbopack dev; `transpilePackages: ['@mitsinjo/engine']`; `optimizePackageImports: ['lucide-react','recharts','@react-three/drei']`.
- Static generation for every route (no request-time data except `/api/copilot`).
- Vercel: copilot route `runtime = 'nodejs'`, `maxDuration = 30`.
