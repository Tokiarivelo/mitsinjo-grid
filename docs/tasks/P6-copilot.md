# P6 — Meta copilot (Days 6–7)

**Read first:** `docs/copilot.md` · `docs/contracts.md` (tools, SSE) · `docs/design/screens/copilot.md`
**Goal:** natural-language questions → controlled tool calls → explanation grounded in computed evidence.

- [x] **P6-T0** Design gate in for every screen of this phase: Run `/design-check` gate-in (spec + Stitch mockup from `docs/design/stitch-map.md`) before coding.
- [x] **P6-T1** `provider.ts` interface + `providers/mock.ts` (deterministic) + tests.
- [x] **P6-T2** `tools.ts`: 5 tools, Zod-validated args, compact outputs, server-side engine calls.
- [x] **P6-T3** `loop.ts`: tool rounds ≤ 4, 20 s budget, SSE events (activity/delta/evidence/proposal/error/done).
- [x] **P6-T4** `app/api/copilot/route.ts`: body validation, rate limit, provider fallback to mock on error.
- [x] **P6-T5** `providers/meta.ts` per P0-T1 findings; env-driven model id with dynamic model listing from Meta API (`GET /models`) and fallback to `env.META_MODEL`.
- [x] **P6-T6** UI: CopilotPanel (right, 360 px) + `/copilot` full view; ChatMessage variants (user / AI explanation / computed evidence / tool activity / error), suggested prompts, ConfirmProposalDialog → `store.applyProposal` → run.
- [x] **P6-T7** Eval cases from `copilot.md` §5 against mock (CI) and Meta (manual, results noted in HANDOFF).
- [x] **P6-T8** Error states: AI unavailable keeps all computed results visible.
- [x] **P6-T9** `propose_change` can propose a strategy switch: optional `strategy: StrategyId` beside `patch` (≥ 1 required); `proposal` SSE carries it; ConfirmProposalDialog shows the strategy diff; `store.applyProposal` sets `activeStrategy` then runs. Tests + eval case 8. Sector priorities / caps → `PY-sector-control.md`.
- [x] **P6-T10** Dynamic suggested prompts: `features/copilot/utils/suggest-prompts.ts` maps the engine result (warnings, `affectedSectors`, `criticalUnservedKwh`, active strategy, scenario) to ≤ 6 i18n keys with params (sector, hours, strategy); static list only as fallback when no result. Pure function + Vitest.
- [x] **P6-T11** Bilingual mock: `providers/mock.ts` matches EN + FR keywords (e.g. `centre de santé`, `solaire`, `stratégies`, `batterie`) and answers in the user's language; every suggested prompt (EN/FR) routes to the right tool. Test per suggested prompt.
- [x] **P6-T12** Scope guardrail: system prompt rule "only this simulated microgrid; politely refuse off-topic and suggest a related question"; mock detects off-topic → same refusal, no tool call. Eval case 9.

**Exit criteria:** `/design-check` gate-out passed: screenshot matches mockup (or deviations logged); row status `checked`. Plus: "Simulate a 40 % solar drop for 2 hours and compare strategies" works end-to-end; every number in the answer appears in an evidence block; proposals never auto-apply.
