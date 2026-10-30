# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-30 · **By:** Claude Code · **Branch:** `feat/meta-models` · **PR:** none yet · committed 46e8265 + mock fix

## State

- Plan `docs/tasks/PM-meta-models.md`. Done this session: **M1-T2** (clinic guard), **M3-T1/T2** (voice), chat UX pass.
- M1-T2: engine `clinicGuard(patch)` (`safety.ts`) → red alert + 2-click Approve in the dialog; tool data `clinicGuard`.
- Decisions: Approve/Reject apply **that message's** proposal once (old bug: applied the latest one), lock the card
  (badge, no buttons, snapshot values), post a `role:'decision'` message (saved via sessions POST, sent to the model as
  `[Operator decision] …`). Neon: `copilot_messages.decision`, `copilot_sessions.summary/summarized_count` (ALTER IF NOT EXISTS).
- Fallback: chat budget 20 → 40 s, one retry on 429/5xx/network, `reason: timeout|provider_error|spend_cap`, budget spent
  between rounds → mock finishes (no LOOP_ERROR). UI: amber note on the answer (`fallbackReason`), no red banner.
- Auto-compaction (`server/copilot/compaction.ts`): > 6k tokens or > 24 msgs → fold all but last 6 into a summary
  (numbers with kW/kWh/% scrubbed), SSE `summary`, client sends only newer msgs (≤ 40) + summary. Fail → hard cut 8.
- UI: proposal card uses container queries (stacked buttons in the panel), one-line suggestions hidden while answering,
  stick-to-bottom scroll, panel header wraps, `parseMessageSections` rewritten (missing section no longer duplicates
  the next; FR "Et ensuite" + MG headings), i18n for model labels/alts, touch targets ≥ 40 px.
- Voice: `useVoiceInput` (MediaRecorder → 16 kHz WAV → `POST /api/voice` → text in the input). Replaces Web Speech API
  (failed on Firefox/Linux Chromium with "Reconnaissance vocale non supportée").
- Mock numbers: chart answer calls `get_grid_state({hourly:true})` (24 h series + highlights, in evidence); photo answer
  and fallback SVG carry no invented numbers.
- Checks: `make check` ✓ (engine 209, web 587). Shots /simulation copilot tab 1440/390 dark/light ✓.
  `make e2e` reuses dev server :3001; on this throttled machine navigation steps time out at random (pages untouched).

## Next task

- Rerun `make e2e` in CI / dev server stopped. Live check A53–A67 with Meta key. Then **M1-T3** (K2 "now" → `fromHour`).

## Decisions taken

- Clinic guard + decision lock are code (UI recomputes from patch); the model only gets informed.
- Summary never carries energy numbers; sent as a system note saying numbers are not evidence.
- Audio is not stored; route accepts WAV only (Meta Voice requirement), conversion is client-side.

## Files touched this session

- Engine `safety.ts`; server `copilot/{loop,compaction,history,tools}.ts`, `providers/mock.ts`, `db/neon.ts`, api `copilot`,
  `sessions/[id]`, `voice`; web `features/copilot/**` (hooks, ui, utils), messages ×3; docs; scenarios A36, A50–A67.
