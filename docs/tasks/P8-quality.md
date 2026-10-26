# P8 — Quality, performance, accessibility (Day 9)

**Read first:** `docs/design/states-copy.md` · `docs/conventions.md` (Tests)

- [ ] **P8-T1** Playwright `e2e/demo-path.spec.ts`: load → cloudy_afternoon → run → compare → ask copilot (mock) → evidence visible.
- [ ] **P8-T2** All empty/loading/error/modified states match `states-copy.md`.
- [ ] **P8-T3** A11y pass: keyboard nav, focus-visible, slider aria values, contrast, labels on status colors.
- [ ] **P8-T4** Run `/perf-audit`; every budget in `docs/performance.md` §1 passes or is listed as a known limit.
- [ ] **P8-T5** Responsive check 1440 / 1024 / 390 px.
- [ ] **P8-T6** Known limitations list (feeds README).

**Exit criteria:** CI green incl. e2e; demo path runs 3× in a row without intervention.
