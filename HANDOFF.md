# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-30 · **By:** Claude Code · **Branch:** `feat/meta-models` · **PR:** none yet · **All uncommitted**

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
- Checks: typecheck ✓ lint ✓ i18n ✓ prettier ✓; engine 209, web 585 all pass. `make test` exits 1 only on a Vitest
  worker RPC timeout (machine thermally throttled, load ≈ 24). `simulation.test.tsx` timeout raised to 15 s.
- Screenshots /simulation copilot tab 1440/390 dark/light ✓ (stubbed SSE), no overflow.

## Next task

- Commit (not asked yet). Live check A53–A65 with Meta key (fallback reasons, voice with Meta, compaction).
- Then **M1-T3** (K2 "now" → `fromHour`). Known issue: mock chart answer hardcodes "42 kW / 52 %" (`providers/mock.ts`,
  chart branch) — breaks "numbers only from engine"; fix by building it from engine output.

## Decisions taken

- Clinic guard + decision lock are code (UI recomputes from patch); the model only gets informed.
- Summary never carries energy numbers; sent as a system note saying numbers are not evidence.
- Audio is not stored; route accepts WAV only (Meta Voice requirement), conversion is client-side.

## Files touched this session

- Engine: `safety.ts`, `schemas/impact.ts`, `index.ts`, tests. Server: `copilot/{loop,compaction,history,tools}.ts`,
  `providers/mock.ts`, `db/neon.ts`, `app/api/{copilot/route,copilot/sessions/[id]/route,voice/route}.ts`
- Web copilot: `types.ts`, hooks `use-copilot`, `use-proposal-diff`, `use-voice-input`; ui `confirm-proposal-dialog`,
  `clinic-guard-warning`, `proposal-diff-list`, `proposal-decision-message`, `chat-message-item`, `copilot-workspace`,
  `suggested-prompts`, `proposal-impact`, `tool-activity`; utils `decisions`, `history`, `parse-sections`, `wav`; messages ×3
- Docs: contracts, copilot, architecture, engine-spec, design/{components,stitch-map}, tasks/PM, README. Scenarios A50–A65, A36.
