# Maintenance rules (always on): keep Makefile and docs in sync with the code

## Makefile

- When you add or use a command someone will run again (script, test filter, generator, tool, deploy step),
  add a Makefile target in the matching `##@` section with a `## short description`. Check `make help` shows it.
- When a `package.json` script is added, renamed or removed, update the target that wraps it in the same commit.
- Targets that need the workspace start with `$(need_ws)`. Keep recipes short; put long logic in `scripts/*.sh`.
- Don't add one-off or destructive targets without a clear name (`clean-*`, `deploy`).

## .env.example (always in sync)

- `.env.example` lists **every** env var the project reads: app (`src/lib/env.ts`), tooling and MCP
  (`.mcp.json`), scripts, CI, deploy. Add, rename or remove a var → update `.env.example` in the same commit.
- Group by section with a one-line comment: what reads it, where to get the value, and allowed values.
- Placeholders or safe defaults only (`LLM_PROVIDER=mock`), never real values. Secrets go in `.env` / `.env.local` (gitignored).
- Also update what loads env (`scripts/env.sh`, Makefile `env` / `claude` / `env-export`) and the README run
  section when the setup steps change.

## Documentation (same commit as the code, update only what changed, keep it terse)

| You changed…                                                       | Update                                                                            |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Types, schemas, tool I/O, SSE events, store shape                  | `docs/contracts.md`                                                               |
| Energy model, strategy, metric, warning, scenario, default numbers | `docs/engine-spec.md`                                                             |
| Folders, data flow, new package or route                           | `docs/architecture.md`                                                            |
| Copilot tool, prompt, provider, eval case                          | `docs/copilot.md`                                                                 |
| Screen layout, component API, tokens, copy, states                 | matching `docs/design/*.md`; mockup deviation → `docs/design/stitch-map.md` Notes |
| Perf technique or budget                                           | `docs/performance.md`                                                             |
| Code/test/commit convention                                        | `docs/conventions.md`                                                             |
| New command or env var                                             | `Makefile`, `.env.example`, `README.md` (run section)                             |
| New user-visible feature or limit                                  | `README.md` (features / limits), `docs/tasks/Pn-*.md` (tick or add task)          |
| New skill or rule                                                  | `CLAUDE.md` skills & rules list                                                   |
| Any of the above at session end                                    | `HANDOFF.md` "Files touched" + "Decisions"                                        |

- Docs describe what the code does now: no plans written as facts, no copied code blocks longer than a type signature.
- If code and doc disagree and you can't tell which is right, ask; don't silently "fix" either.
