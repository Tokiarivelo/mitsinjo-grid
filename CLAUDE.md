# Mitsinjo Grid — Agent entry point

AI copilot for a **simulated** rural solar microgrid (Meta AI Hackathon, solo, 10 days).
Demo path that must always work: **solar drop → strategy comparison → AI explanation → computed evidence**.

## Start here (token budget rule)

1. Read `HANDOFF.md` (current state, next task). Always.
2. Read the task file it points to: `docs/tasks/Pn-*.md`. Only that one.
3. Load other docs **only** when the task's "Read first" list names them.
4. Never load `Mitsinjo_Grid_*.md` at repo root — long human sources, already distilled into `docs/`.
5. Find code with `rg`/`glob`; read package `index.ts` barrels before internals.
6. Before ending a session: update `HANDOFF.md` (overwrite, ≤40 lines) and tick task boxes.

## Skills & rules (auto, cheap)

- Skills (`.claude/skills/`, loaded only when invoked): `/start` · `/handoff` · `/verify` · `/engine-change` ·
  `/ui-feature` · `/copilot-tool` · `/scene-3d` · `/perf-audit` · `/design-dispatch` · `/design-check`.
- Rules (`.claude/rules/`, loaded only when matching files are touched): engine · web-ui · three · copilot · tests.
  `maintenance` is always on: new useful command → Makefile target; feature change → update its doc (same commit).
  Don't restate them here; this file stays global-only.

## Doc map

| Need                                           | File                                                      |
| ---------------------------------------------- | --------------------------------------------------------- |
| Folder layout, data flow, who owns what        | `docs/architecture.md`                                    |
| Types, Zod schemas, tool I/O (source of truth) | `docs/contracts.md`                                       |
| Energy model, strategies, default numbers      | `docs/engine-spec.md`                                     |
| LLM provider, tools, prompts, fallback         | `docs/copilot.md`                                         |
| Code rules, naming, tests, commits             | `docs/conventions.md`                                     |
| Fluidity budgets & perf techniques             | `docs/performance.md`                                     |
| UI tokens, components, screens, Stitch         | `docs/design/README.md` → one file                        |
| Which mockup belongs to which screen           | `docs/design/stitch-map.md` (exports in `design/stitch/`) |
| Phase plan / tasks                             | `docs/tasks/README.md`                                    |

## Stack

pnpm workspace + Turborepo · Next.js 15 App Router · React 19 · TS strict · Tailwind 4 (`@theme`) ·
shadcn/ui (restyled) · Zustand · Zod · R3F + Drei · Recharts · Vitest · Playwright · Meta Llama API.

## Non-negotiable rules

- Numbers come **only** from `@mitsinjo/engine`. UI, 3D and LLM never compute or invent energy values.
- Engine is pure TS: no React, no DOM, no network, no `Math.random` without seed.
- `app/**/page.tsx` = import + render a feature page. No logic.
- Feature code lives in `apps/web/src/features/<name>/{ui,hooks,utils,__tests__}`; export via `index.ts`.
- Every engine function and hook ships with a Vitest test in the same commit.
- Server-only code (LLM key, tools) lives in `apps/web/src/server/` and imports `server-only`.
- **Design gate:** every frontend change (route, layout, component, 3D) goes through `/design-check`:
  spec + Stitch mockup before coding, screenshot comparison after. Contracts > design rules > mockup.
- Every screen shows a `SIMULATED DATA` label; AI text is visually distinct from computed metrics.
- No secrets in repo; env vars via `apps/web/src/lib/env.ts` (Zod-validated).
- Conventional commits: `feat(engine): ...`, `fix(copilot): ...`.

## Commands

Use the Makefile (`make help` lists everything). Most used:

```bash
make install && make dev    # web on :3000 (make dev-mock = offline LLM)
make check                  # typecheck + lint + test — before handoff
make test-engine            # engine only (cheapest)
make e2e                    # playwright demo path
make shots                  # screenshots of all routes → design/shots/ (design gate)
make status | make todo     # current state / unchecked tasks (cheaper than reading files)
```
