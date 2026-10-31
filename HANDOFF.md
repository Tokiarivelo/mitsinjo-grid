# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-31 · **By:** Claude Code · **Branch:** `feat/meta-models` · **PR:** none yet · last commit ee7b654; fire alarm work below **uncommitted**

## State

- Plan `docs/tasks/PM-meta-models.md`. Done: M1-T1…T5 (impact, clinic guard, "now", undo, per-line approval), M3-T1/T2 (voice).
- **M1-T5** (K3): checkbox per proposal line (`useProposalSelection`, `utils/proposal-parts.ts`); engine block + clinic guard
  follow the checked lines (`lib/proposal-impact.ts`, shared with `propose_change`); decision carries `skipped`; mock cuts
  every sector named before « garde / keep / sauf ». Scenarios A88–A92.
- **Fire alarm (M2-T1 ✓, M2-T2 ✓ except chat button, M2-T3 code only):** engine `fire` event (0 kW cap that beats caps +
  floor, `FIRE_ISOLATION`, v0.4.0, `src/fire.ts`); store `reportFire`; `features/fire-alert` (auto snackbar, big sticky banner
  in AppShell, compact banner in the viewport, « Report a fire » in every view HUD + the deck); 2D « On fire » card + cut wire;
  3D `fire-effects.tsx` (flames, instanced smoke, light on high). Scenarios S83–S88.
- Checks: tsc ✓, eslint ✓, prettier ✓, i18n ✓, web 687/687, engine 230/231 (sweep < 50 ms bench fails on this machine
  with or without the change: 52–85 ms).

## Next task

- **First: PV vision insert** (`docs/tasks/PV-vision-insert.md`, branch `claude/object-detection-3d-editor-gxfzw1`).
  V1 done: PV-T1 catalog, T2 `input.appliances` in sector demand (v0.5.0), T3 strategies/warnings test. PV-T4 ✓ `detectAppliances` in `server/perception`. PV-T5 partial (SAM box refinement; mask decode waits for a licence decision, see task). Next PV-T6, then T7…T14. Other items wait.
- `make e2e` when convenient.
- Live check with a Meta key: does Spark call `control_playback` for "pause" / "go to 18:00"? Note it in docs/copilot.md.
- Screenshots (design gate) not taken: M1-T5 card, fire banner/snackbar, 3D fire, 2D « On fire » (dark + light, 390 px);
  measure 3D fps with a fire (`?perf=1`). Then commit the fire work.
- Then M2-T4 (`get_incidents`, restore via `propose_change`, chat fire button) or **M1-T6** (4 eval cases).

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
