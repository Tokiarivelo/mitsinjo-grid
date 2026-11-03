# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-03 (PA-3 closed) · **By:** Antigravity · **Branch:** feat/pa-ai-dispatch

## Current state

- Branch `feat/pa-ai-dispatch` created from latest `main`.
- Rule encoded: branch from latest `main` when beginning task (`CLAUDE.md`, `conventions.md`, `review.md`).
- PA-T3 closed (PA-T3a, PA-T3b, PA-T3c):
  - Store: `dispatchMode` ('manual'|'assisted'|'autonomous'), `dispatchLog`, `setDispatchMode`, `takeBackControl`.
  - Neon migration: `0004_dispatch_log` applied to Neon (`make db-migrate`).
  - API: `GET|POST|DELETE /api/dispatch/log` route + `neon.ts` helpers.
  - Hook: `useAiDispatch` detects, decides, applies and logs in autonomous mode (`village_fire` test green).
  - Copilot: `propose_change` applies alone after constitution check in autonomous mode, logged with operator origin.

## Next

- **PA-4** (`docs/tasks/PA-ai-dispatch.md`): UI toggle 3-tier, dispatch log panel, critical alerts banner.

## Files touched (this session)

`CLAUDE.md`, `.claude/rules/review.md`, `docs/conventions.md`, `docs/contracts.md`, `docs/tasks/PA-ai-dispatch.md`,
`packages/engine/src/autonomy.ts`, `apps/web/src/server/db/{migrations,neon}.ts`,
`apps/web/src/stores/{simulation.store,selectors}.ts`, `apps/web/src/features/autopilot/{use-ai-dispatch,use-autopilot,index}.ts`,
`apps/web/src/features/copilot/hooks/use-copilot.ts`, `apps/web/src/app/api/dispatch/log/route.ts`,
tests (store, migrations, route, ai-dispatch, copilot). Scenario S90.

## Decisions

- Fire isolation in engine ignores already-isolated sectors so secondary fires (e.g. water at 15h) are not starved.
- Copilot operator proposals in autonomous mode validate village constitution before auto-applying.
