---
name: perf-audit
description: Measure and fix app fluidity and performance (bundle, rerenders, 3D fps, Web Vitals) against the budgets in docs/performance.md. Use in P8 or when the app feels slow.
---

Load only `docs/performance.md`.

1. Build: `pnpm --filter web build` → read the route size table; flag any first-load JS over budget.
2. Bundle: `ANALYZE=true pnpm --filter web build` (if @next/bundle-analyzer is set) → confirm three/R3F/recharts only in lazy chunks.
3. Rerenders: React DevTools profiler on slider drag; any component rendering on unrelated store change → narrow selector / `useShallow` / split component.
4. Engine: run bench test; `compare()` must stay < 10 ms.
5. 3D: dev perf overlay (`r3f-perf` or `gl.info`) → fps, draw calls, triangles vs budget.
6. Vitals: `npx lighthouse http://localhost:{port}/overview --preset=desktop --only-categories=performance --quiet --output=json | jq '.categories.performance.score, .audits["interaction-to-next-paint"].displayValue'`.
7. Report: table metric · value · budget · pass/fail · fix applied. Fix highest-impact first.
