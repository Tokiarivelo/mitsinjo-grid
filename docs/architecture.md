# Architecture

## 1. Choice and why

**Light monorepo: pnpm workspace + Turborepo, one app + one pure package.**
Pattern: Turborepo, feature-sliced Next app, pages = imports only,
trimmed for a solo 10-day build: no NestJS, no DB, no Python, no shared-config package.

| Option                                        | Verdict     | Reason                                                                                      |
| --------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| Single Next app, engine in `lib/`             | OK fallback | Fastest, but engine can leak React/DOM deps                                                 |
| **apps/web + packages/engine**                | **Chosen**  | Engine isolation enforced by package boundary; tested alone; same code runs client + server |
| Next + NestJS + Python                        | Rejected    | 3 runtimes, JSON contracts, deploy cost; no gain at this scale                              |
| Separate `ai-agent` / `shared-types` packages | Rejected    | One consumer each → merged (agent in `web/src/server`, types = engine Zod schemas)          |

## 2. Tree

```text
mitsinjo-grid/
├── CLAUDE.md  AGENTS.md  HANDOFF.md  README.md  LICENSE  .env.example
├── package.json  pnpm-workspace.yaml  turbo.json  tsconfig.base.json
├── .github/workflows/ci.yml            # typecheck + lint + test
├── docs/                               # agent docs (see docs/README.md)
├── scripts/                            # shell helpers called by the Makefile (env.sh: load .env)
├── packages/
│   └── engine/                         # @mitsinjo/engine — pure TS, deps: zod only
│       └── src/
│           ├── schemas/                # Zod: input, result, tools (types inferred)
│           ├── model/                  # solar.ts, demand.ts, battery.ts, step.ts
│           ├── strategies/             # proportional.ts, essential-first.ts, balanced.ts, index.ts
│           ├── metrics/                # aggregate.ts, warnings.ts
│           ├── scenarios/              # baseline, cloudy-afternoon, … (typed presets)
│           ├── simulate.ts  compare.ts  hash.ts
│           ├── index.ts                # public API — the only import path
│           └── __tests__/
└── apps/
    └── web/                            # Next.js 15 App Router
        ├── e2e/                        # Playwright: demo-path.spec.ts
        └── src/
            ├── app/
            │   ├── layout.tsx  globals.css (@theme tokens)  page.tsx → redirect /overview
            │   ├── (lab)/layout.tsx    # AppShell
            │   ├── (lab)/{overview,simulation,strategies,scenarios,copilot}/page.tsx
            │   └── api/copilot/route.ts
            ├── features/
            │   ├── overview/           # ui/ hooks/ utils/ __tests__/ index.ts
            │   ├── simulation/         # controls, run/reset, timeline
            │   ├── microgrid-3d/       # R3F scene, dynamic(ssr:false) + 2D fallback
            │   ├── strategy-lab/
            │   ├── scenarios/          # cards, assumptions, export summary
            │   └── copilot/            # chat UI, useCopilot, proposal dialog
            ├── components/{ui,layout,charts}/
            ├── stores/simulation.store.ts   # single source of UI state
            ├── server/copilot/         # server-only: provider, tools, prompts, loop
            └── lib/{env.ts,format.ts,utils.ts}
```

Create folders when first needed, not up front.

## 3. Data flow

```text
 Controls / Scenario preset / Approved AI proposal
                │  SimulationInput (Zod-valid)
                ▼
     useSimulationStore.run()  ──►  engine.compare(input, strategies)  (client, <10 ms)
                │  results: Record<StrategyId, SimulationResult>
     ┌──────────┼──────────────┬──────────────┐
     ▼          ▼              ▼              ▼
 MetricCards  Charts      3D scene        Strategy Lab      ← all read the SAME result

 Chat ─► POST /api/copilot {messages, input} ─► server loop:
          LLM ⇄ tools (get_grid_state, run_scenario, compare_strategies, get_sector_metrics, propose_change)
          tools call engine server-side (re-compute from input, never trust client numbers)
       ◄─ stream: text + tool activity + evidence {resultId, fields} + optional proposal
 Proposal ─► ConfirmProposalDialog ─► user approves ─► store.setInput() ─► run()
```

## 4. Ownership boundaries

| Layer              | May                                       | May not                                   |
| ------------------ | ----------------------------------------- | ----------------------------------------- |
| `packages/engine`  | compute all numbers, validate input       | import React/Next, fetch, read env        |
| `stores/`          | hold input, status, results, selection    | compute energy values                     |
| `features/*/ui`    | render props                              | call engine or store directly (use hooks) |
| `features/*/hooks` | read store, call engine via store actions | fetch LLM except `copilot/hooks`          |
| `server/copilot`   | call LLM + engine, validate tool args     | be imported by client code                |
| 3D scene           | map result fields → visuals               | derive or interpolate energy values       |

## 5. Store shape (summary; types in contracts.md)

`{ scenarioId, input, status, results, activeStrategy, selectedSector, timeIndex }`
actions: `loadScenario, patchInput, run, reset, selectStrategy, selectSector, setTimeIndex, applyProposal`.
`patchInput` sets `status='modified'`; `run` sets `complete`. Selectors live in `stores/selectors.ts`.

## 6. Deployment

Vercel (Next native). Env: `LLM_PROVIDER=meta|mock`, `META_API_KEY`, `META_MODEL`, `META_BASE_URL`.
Copilot route: `runtime='nodejs'`, rate limit per IP (in-memory, demo-grade), timeout 20 s.
