# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-27 · **By:** Antigravity (P6 Meta Copilot & Simulation Advisory) · **Day:** 7 / 10

## State

- Phase: **P6 — Meta copilot & simulation advisory** completed (P6-T0..P6-T12 done; gate-out passed).
- Monorepo healthy: `make check` (84 engine + 129 web = 213 passing tests, 100% i18n parity, 0 lint/tsc errors), `pnpm build` clean.
- Features delivered:
  - Copilot backend: `LlmProvider`, `MockLlmProvider` (bilingual EN/FR, scope guardrail), `MetaLlmProvider` (dynamic model listing from `GET /models` with fallback to `env.META_MODEL`), 5 Zod tools, SSE loop (`activity`, `delta`, `evidence`, `proposal`, `error`, `done`), `/api/copilot` and `/api/copilot/models`.
  - Copilot UI: `/copilot` operational deck + 360px `CopilotPanel`, model selector dropdown, structured `ChatMessageItem` (4-section: What happened, Computed evidence, Why it matters, Explore next), `ToolActivity`, `ConfirmProposalDialog` with parameter/strategy diff, computed `ContextPanel`, dynamic `suggestPrompts`.
  - Eval suite: 9 eval cases (including off-topic refusal & strategy switch proposal) + evidence integrity + bilingual mock tests in CI.
  - Design check gate-out: `design/shots/copilot.png` captured at 1440x900, row `AI Copilot` in `stitch-map.md` marked `checked`.

## Next task

- `docs/tasks/P7-scene-3d.md` (Days 7–8: Interactive 3D village grid with Three.js / React Three Fiber, power flows, and daytime lighting).

## Decisions taken

- Numbers come **strictly** from `@mitsinjo/engine`; LLM cites `resultId` and emits `evidence` events; UI renders evidence cards from tool outputs without hallucinations.
- Parameter changes and strategy switches are never auto-applied: operator confirmation via `ConfirmProposalDialog` is mandatory.
- Multi-model selection: Meta models fetched from `GET /models` per `https://dev.meta.ai/docs/api-reference/models/list-models`, with fallback to `env.META_MODEL` (`DEFAULT_META_MODEL`).
- Scope guardrail: requests outside the rural microgrid (poems, jokes, recipes) are politely refused with zero tool calls and prompt suggestions.

## Open questions / blockers

- None. Ready for P7 3D scene implementation.

## Files touched this session

- `apps/web/src/server/copilot/**`, `apps/web/src/features/copilot/**`, `apps/web/src/app/api/copilot/**`
- `apps/web/src/components/layout/copilot-panel.tsx`, `apps/web/src/messages/{en,fr,mg}.json`, `apps/web/src/stores/simulation.store.ts`
- `docs/tasks/P6-copilot.md`, `docs/design/stitch-map.md`, `HANDOFF.md`
