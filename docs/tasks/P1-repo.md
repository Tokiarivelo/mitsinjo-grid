# P1 — Repo & agent tooling (Day 1, ~4 h)

**Read first:** `docs/architecture.md` §2 · `docs/conventions.md`
**Goal:** a running empty shell with CI, so every later session starts green.

- [x] **P1-T0** `git init -b main` + complete `.gitignore` (done 2026-10-26).
- [x] **P1-T1** `pnpm-workspace.yaml`, root `package.json` (turbo scripts: dev/build/test/typecheck/lint), `turbo.json`, `tsconfig.base.json`, Prettier. (Done 2026-10-26)
- [x] **P1-T2** `packages/engine`: package.json (`name @mitsinjo/engine`, `main: src/index.ts`, deps zod), vitest config, one smoke test. (Done 2026-10-26)
- [x] **P1-T3** `apps/web`: `create-next-app` (TS, App Router, Tailwind 4, src dir, ESLint), add deps: zustand, zod, recharts, lucide-react, clsx, tailwind-merge, `@react-three/fiber`, `@react-three/drei`, three, server-only; dev: vitest, @testing-library/react, jsdom, @playwright/test. `transpilePackages: ['@mitsinjo/engine']`. (Done 2026-10-26)
- [x] **P1-T4** `src/lib/env.ts` (Zod env) matching the LLM section of `.env.example` (already exists; keep in sync). (Done 2026-10-26)
- [x] **P1-T5** Routes stubs `(lab)/{overview,simulation,strategies,scenarios,copilot}` rendering placeholder feature pages; `/` → redirect `/overview`. (Done 2026-10-26)
- [x] **P1-T6** `.github/workflows/ci.yml`: pnpm install → typecheck → lint → test. (Done 2026-10-26)
- [ ] **P1-T8** (human) Install Claude settings + format hook: `docs/setup/README.md`.
- [x] **P1-T9** Next config per `docs/performance.md` §8 (transpilePackages, optimizePackageImports, React Compiler). (Done 2026-10-26)
- [x] **P1-T7** README skeleton (problem, run commands, "simulated data" disclaimer), `LICENSE` (per P0-T2). (Done 2026-10-26)

**Exit criteria:** `pnpm dev` serves 5 routes; `pnpm test && pnpm typecheck` green; CI green on first push.
