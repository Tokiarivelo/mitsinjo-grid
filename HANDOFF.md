# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-31 · **By:** Claude Code · **Branch:** `feat/meta-models` · **PR:** none yet · last commit 294e70a

## State

- Plan `docs/tasks/PM-meta-models.md`. Done: M1-T1…T5 (impact, clinic guard, "now", undo, per-line approval), M3-T1/T2 (voice).
- **M1-T5** (K3): checkbox per proposal line (`useProposalSelection`, `utils/proposal-parts.ts`); engine block + clinic guard
  follow the checked lines (`lib/proposal-impact.ts`, shared with `propose_change`); decision carries `skipped`; mock cuts
  every sector named before « garde / keep / sauf ». Scenarios A88–A92.
- Committed 2026-10-31 as 4 signed commits (each typechecked + its tests run on its own snapshot):
  `7bdbcff` overview incident screen · `93f6484` copilot undo (M1-T4) + Retry + folded evidence + tool-error answers ·
  `22e6cd4` glass full-screen terminal / controls / minimizable timeline (also wires Undo + Retry in the chat) ·
  `294e70a` `control_playback` tool.
- Checks: tsc ✓, eslint ✓, prettier ✓, i18n ✓, web 678/678.
- `make e2e` and `make shots` **not run** this session (e2e stopped by the user); M1-T5 card not screenshotted yet.

## Next task

- `make e2e` when convenient (random nav timeouts seen before).
- Live check with a Meta key: does Spark call `control_playback` for "pause" / "go to 18:00"? Note it in docs/copilot.md.
- `make shots`: proposal card with checkboxes, dark + light, 390 px (design gate for M1-T5).
- Then **M1-T6** (4 eval cases).

## Decisions taken

- Clinic guard + decision lock are code; the model is only told. Summary carries no energy numbers. Audio not stored (WAV).
- "Now" = app hour (system note). Undo restores the whole input (also later slider edits). History not kept on reopen.
- `control_playback` is the only tool applied without approval: it moves the view, never inputs or results.
- Full screen and overview incident screen built without mockup (stitch-map notes). Modals render outside `GlassPanel`.
- K3: lines with no dialog row (solar profile, meter readings, shares, weights) always go with the patch. No ICU plural in
  the approve label (test i18n only does `{x}`).

## Files touched this session

- Split previous work into 4 commits. M1-T5: copilot `proposal-diff-list`, `confirm-proposal-dialog`, `chat-message-item`,
  `proposal-decision-message`, hooks `use-proposal-diff`, `use-proposal-selection` (new), `use-copilot`, utils `proposal-parts`
  (new), `decisions`; `lib/proposal-impact.ts` (new); server `tools`, `prompt`, `providers/mock`; sessions route; messages ×3;
  docs contracts, copilot, components, stitch-map, PM task.
