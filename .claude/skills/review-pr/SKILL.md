---
name: review-pr
description: Review a GitHub PR or local branch against Mitsinjo Grid rules — rebase onto latest main, check rules/contracts/i18n/design gate, fix issues on the branch, wait for green CI, then merge. Use when asked to review, check, fix or merge a PR.
---

Follow `.claude/rules/review.md`. Steps:

1. **Load the PR:** `gh pr view <n> --json title,headRefName,baseRefName,mergeable,files,statusCheckRollup,reviews,comments`.
   Read its task file (`docs/tasks/Pn-*.md`) and only the specs that task names.
2. **Rebase onto latest main:** `git checkout <head> && git pull` then `make rebase-main` unless already up to date.
   On conflicts: resolve, `make check`, `git push --force-with-lease`.
3. **Read the diff** into the scratchpad: `git diff origin/main...HEAD -- apps packages ':!*.json' > <scratchpad>/pr.diff`, then read it in chunks.
4. **Check, in order of severity:**
   - Wrong numbers: values not from `@mitsinjo/engine`, math in UI, wrong unit/scale, hardcoded data that contradicts engine input.
   - Contracts: types/store/tool I/O changed without `docs/contracts.md`.
   - i18n: literals in JSX, `aria-label`s, error copy, untranslated enum values (priorities, statuses), key parity.
   - Feature-slice layout, `page.tsx` has no logic, narrow store selectors, token-only styling, `SIMULATED DATA` label.
   - Tests: every new hook/util/engine function has a Vitest test; tests query by role/label.
   - Duplication (blocking): repeated logic/markup/copy or a re-implemented existing helper (`rg` for it) →
     extract once per `docs/conventions.md` § Reuse (with a test), replace every copy.
   - Docs/Makefile/`.env.example`/`HANDOFF.md` kept in sync (`maintenance` rule).
   - Frontend change → design gate-out done (stitch-map row `checked`, screenshots).
5. **Fix** on the branch, `make check`, commit `fix(<scope>): address PR #<n> review`, push.
6. **Wait for CI** (`gh pr checks <n>`, poll until no pending). Red → fix and repeat.
7. **Merge** only if green and not behind main: `gh pr merge <n> --merge`; then `git checkout main && git pull`.
8. **Reply** ≤ 10 lines: merged or not, what was fixed (with user impact), what was left and why.
