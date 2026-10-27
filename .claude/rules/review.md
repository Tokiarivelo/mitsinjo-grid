# Review rules (always on): reviewing or merging a PR or branch

- **Rebase first, always.** Before reviewing, fixing or merging, bring the branch onto the latest `main`:
  `make rebase-main` (fetches `origin/main`, rebases the current branch). Skip only if `git merge-base --is-ancestor origin/main HEAD` already passes.
  Resolve conflicts keeping both sides' intent, rerun `make check`, then `git push --force-with-lease` (never plain `--force`).
- Review against the rules, not taste: `CLAUDE.md` non-negotiables, the matching `.claude/rules/*`, the task file's checkboxes, and `docs/contracts.md`.
- Check every number on screen is engine output, formatted with the right unit and scale (`fmtPct` takes 0–100).
- Check zero static text: no user-visible literal in JSX/TSX, keys in `en`/`fr`/`mg` (`make check-i18n`).
- Fix what you find on the PR branch in a separate `fix(<scope>): address PR #n review` commit. Add a test for each bug fix.
- Merge only when CI is green on the rebased head. Use the repo's merge style (merge commit). Never merge a branch that is behind `main`.
- Report: fixed items first, then the issues you did not fix and why.
