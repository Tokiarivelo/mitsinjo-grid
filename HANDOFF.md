# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-28 · **By:** Claude (PR #19 review + port + formatting) · **Branch:** `fix/simulation-controls-validation`

## State

- PR #19: drop sliders keep draft values; a valid move on any drop control clears all drop errors; reset/run resync.
- Review fix: stale horizon error on the solar drop % slider kept Run disabled → fixed + regression test.
- Engine `getSolarDrop(input)` + `DEFAULT_DROP_START_HOUR/DURATION_H` replace 6 copies of the 12 h / 3 h defaults.
- Web port from `PORT` env (`.env`, 3001 locally, default 3000) via `apps/web/scripts/port.mjs`; `make port`.
- Formatting: Prettier 3.9.10 pinned, only formatter; pre-commit hook (simple-git-hooks + lint-staged), CI `format:check`.
- Checks green: typecheck, lint, 102 engine tests, 244 web tests, format check.

## Next task

- Merge PR #19 once CI is green, then `make e2e` & `make shots` (dual themes, mobile), then `make todo`.

## Decisions taken

- Drop errors are one group (`solarDropPct`, `dropStartHour`, `dropDurationH`): validated together, cleared together.
- Claude edit hook stays human-installed (`make setup-claude`); auto mode blocks agents committing `.claude/settings.json`.
- Non-Claude agents: `AGENTS.md` / `GEMINI.md` → run `make format-changed`; pre-commit hook covers everyone.

## Open questions / blockers

- Overview `sheddingProtocolDesc` ("below 20%") + two different site coordinates: static claims, confirm or remove.
- `confirm-proposal-dialog.tsx` diff shows literal `'None'`/`'0%'` as current values and its own drop defaults (12 h / 2 h).
- `compare()` < 10 ms test is flaky under load (13 ms seen once, passes alone).

## Files touched this session

- Simulation: `features/simulation/ui/sim-controls-panel.tsx`, `utils/validate-patch.ts`, `__tests__/simulation.test.tsx`
- Engine: `constants.ts`, `patch.ts`, `__tests__/patch.test.ts`; web `features/scenarios/ui/assumptions-inspector.tsx`
- Port: `apps/web/scripts/port.{mjs,d.mts}`, `package.json`, `playwright.config.ts`, `scene-audit.mjs`, `turbo.json`
- Format: `package.json`, `.claude/rules/format.md`, `.claude/skills/format/`, `docs/setup/*`, `AGENTS.md`, `GEMINI.md`, CI
- Docs: `CLAUDE.md`, `README.md`, `docs/contracts.md`, `.env.example`, `Makefile`
