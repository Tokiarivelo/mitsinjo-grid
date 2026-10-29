# Test scenario rules (always on, every agent): every change ships a manual test scenario

`test-scenarios/` (repo root) holds manual test scenarios, one Markdown file per page. It is **gitignored**
(local only): never commit it, never remove it from `.gitignore`.

## When

Every implementation, addition or modification with behaviour a person can see or trigger (UI, engine result
on screen, copilot answer, command). Skip only for pure refactors, docs, formatting or test-only changes,
and say so in your final reply.

## What

- Add or update the scenarios in the matching page file, in the same session as the code:
  `01-apercu.md` (`/overview`) · `02-simulation.md` · `03-strategies.md` · `04-scenarios.md` · `05-copilote.md`.
  Cross-page behaviour (theme, language, mobile, data consistency) → `99-transverse.md`.
  A change to the demo path (solar drop → comparison → AI explanation → evidence) → also `00-parcours-demo.md`.
  New page → new numbered file + a row in `README.md`.
- Format, in French like the existing files: `- [ ] **ID** — action → expected result`.
  IDs keep the file's prefix (`O`, `S`, `L`, `C`, `A`, `T`, `D`) and continue its numbering; never renumber.
- Name the scenario the user must pick to see the effect (most settings change nothing without an energy
  deficit). Use the UI labels from `apps/web/src/messages/fr.json`, never invented ones.
- Cover the happy path, the main error or limit case, and any fix's regression (the bug's steps → now correct).
- Update or delete scenarios the change made wrong. Expected results describe what the code does now.

## If the folder is missing

Fresh clone or worktree: create `test-scenarios/` with a `README.md` (how to run `make dev-mock`, the scenario
table, the format above) and only the page files you need.

## Report

End your reply with the scenario IDs you added or changed (e.g. `L30–L32, T15`).
