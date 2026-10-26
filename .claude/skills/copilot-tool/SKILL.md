---
name: copilot-tool
description: Add or change a copilot tool, prompt, provider or SSE event for the Meta LLM integration. Use for work in server/copilot, api/copilot or features/copilot.
---

Load only `docs/copilot.md` and the tools/SSE sections of `docs/contracts.md`.

1. Define args with Zod in `server/copilot/tools.ts`; derive JSON schema for the provider from it (single source).
2. Handler calls `@mitsinjo/engine` server-side from the request `input`; returns compact JSON + pushes numeric fields to evidence.
3. Mutating intent → only via `propose_change` (returns proposal, never applies).
4. Update `prompt.ts` only if the tool needs a usage hint (keep prompt ≤ 400 tokens).
5. Teach `providers/mock.ts` the trigger keywords so the demo works offline.
6. Add eval case in `__tests__/eval.cases.ts`; test: invalid args → graceful error; numbers ⊆ evidence.
7. `/verify web`. Manually test with Meta provider if a key is set; record result in HANDOFF.
