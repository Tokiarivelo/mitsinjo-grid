# P6 — Meta copilot (Days 6–7)

**Read first:** `docs/copilot.md` · `docs/contracts.md` (tools, SSE) · `docs/design/screens/copilot.md`
**Goal:** natural-language questions → controlled tool calls → explanation grounded in computed evidence.

- [ ] **P6-T0** Design gate in for every screen of this phase: Run `/design-check` gate-in (spec + Stitch mockup from `docs/design/stitch-map.md`) before coding.
- [ ] **P6-T1** `provider.ts` interface + `providers/mock.ts` (deterministic) + tests.
- [ ] **P6-T2** `tools.ts`: 5 tools, Zod-validated args, compact outputs, server-side engine calls.
- [ ] **P6-T3** `loop.ts`: tool rounds ≤ 4, 20 s budget, SSE events (activity/delta/evidence/proposal/error/done).
- [ ] **P6-T4** `app/api/copilot/route.ts`: body validation, rate limit, provider fallback to mock on error.
- [ ] **P6-T5** `providers/meta.ts` per P0-T1 findings; env-driven model id.
- [ ] **P6-T6** UI: CopilotPanel (right, 360 px) + `/copilot` full view; ChatMessage variants (user / AI explanation / computed evidence / tool activity / error), suggested prompts, ConfirmProposalDialog → `store.applyProposal` → run.
- [ ] **P6-T7** Eval cases from `copilot.md` §5 against mock (CI) and Meta (manual, results noted in HANDOFF).
- [ ] **P6-T8** Error states: AI unavailable keeps all computed results visible.

**Exit criteria:** `/design-check` gate-out passed: screenshot matches mockup (or deviations logged); row status `checked`. Plus: "Simulate a 40 % solar drop for 2 hours and compare strategies" works end-to-end; every number in the answer appears in an evidence block; proposals never auto-apply.
