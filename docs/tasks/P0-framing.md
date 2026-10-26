# P0 — Framing & access (Day 1, ~3 h)

**Read first:** `docs/engine-spec.md` §5–6 · `docs/copilot.md` §1
**Goal:** remove external unknowns before writing code.

- [x] **P0-T1** Verify Meta model access: endpoint, model id, auth, quota, tool-calling format.
      **Done when:** a 20-line script (scratch, not committed) returns a tool call for `get_grid_state`; findings written to `docs/copilot.md` §1 (`providers/meta.ts` notes). (Unset in env -> fallback to `LLM_PROVIDER=mock` documented in `docs/copilot.md` §1).
- [ ] **P0-T2** (human) Read official hackathon rules: submission format, deadline, licence, required Meta model usage, video length.
      **Done when:** constraints listed in `HANDOFF.md` → Decisions.
- [x] **P0-T3** Confirm default parameters and scenarios in `engine-spec.md` §5–6 (keep or edit).
      **Done when:** "PROPOSALS" label removed. (Confirmed 2026-10-26)
- [ ] **P0-T4** (human) Decide UI language: EN (default, judges) with FR toggle stretch, or FR only.
      **Done when:** decision in `HANDOFF.md`.
- [ ] **P0-T5** Write the 8 demo questions / steps (draft of `docs/demo-script.md`).

**Exit criteria:** Meta access known (works / blocked → mock-only plan); parameters frozen.
**If Meta access blocked:** continue with `LLM_PROVIDER=mock`; P6 still builds the full loop.
