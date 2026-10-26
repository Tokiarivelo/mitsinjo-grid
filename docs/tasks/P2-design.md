# P2 — Design system (Day 2, parallel to P3)

**Read first:** `docs/design/README.md`, then only the file each task names.
**Goal:** one consistent visual language, generated once, reused by every screen.

- [x] **P2-T0** (human) Set up Stitch MCP: `docs/setup/README.md` § Stitch MCP.
- [x] **P2-T1** (agent via Stitch MCP, or human in Stitch UI) Generate screens in order using `docs/design/stitch-prompts.md`:
      Live Simulation → Overview → Strategy Lab → Copilot → Scenarios. Export PNG (+ HTML) to `design/stitch/<name>.*` (committed) and fill ids/status in `docs/design/stitch-map.md`.
      **Done when:** 5 consistent screens; screenshots referenced in `HANDOFF.md`.
- [x] **P2-T2** Paste the `@theme` block from `docs/design/tokens.md` into `apps/web/src/app/globals.css`; load fonts with `next/font` (Space Grotesk, Inter, IBM Plex Mono). (Done 2026-10-26)
- [x] **P2-T3** UI kit in `components/ui`: Button, StatusBadge, MetricCard, EnergyBar, SimControl, EmptyState, ChartCard (specs: `design/components.md`). Restyle primitives with tokens. (Done 2026-10-26)
- [x] **P2-T4** `components/layout`: AppShell, Sidebar, Header, CopilotPanel slot (spec: `design/shell.md`); responsive drawer < 1280 px. (Done 2026-10-26)
- [x] **P2-T5** `/design` dev-only route rendering every UI kit variant — fast visual QA for agents and humans. (Done 2026-10-26)
- [x] **P2-T6** Tests: StatusBadge label always rendered (no color-only status), MetricCard shows unit, focus-visible styles present. (Done 2026-10-26)

**Exit criteria:** shell + kit pass `/design-check` against the Stitch screens; no raw hex outside `globals.css`.
**Agent dispatch:** P2-T2…T6 can be given to a separate agent with only `docs/design/**` + `docs/conventions.md` loaded.
