---
paths:
  - 'apps/web/src/server/copilot/**'
  - 'apps/web/src/features/copilot/**'
  - 'apps/web/src/app/api/copilot/**'
---

# Copilot rules

- `server/**` starts with `import 'server-only'`. API key only via `@/lib/env`.
- Every tool arg parsed with Zod before use; invalid → structured error returned to the model, never thrown to client.
- Tools return compact JSON (metrics, no `steps` arrays unless one sector asked). Round to 2 decimals in tool output only.
- The model never receives instructions to invent numbers; every number in UI evidence comes from tool results.
- `propose_change` never mutates state; the client applies only after `ConfirmProposalDialog`.
- Provider failure/timeout → fall back to `mock` provider and emit an `error` event; computed results stay visible.
- Tests use `LLM_PROVIDER=mock` and a fake provider. No network in tests. Spec: `docs/copilot.md`.
