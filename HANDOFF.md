# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-30 · **By:** Claude Code · **Branch:** `feat/meta-models` · **PR:** none yet · committed b669d3a; M1-T3 uncommitted

## State

- Plan `docs/tasks/PM-meta-models.md`. Done: **M1-T2** (engine `clinicGuard` → red alert, 2-click Approve), **M3-T1/T2** (voice), chat UX pass, **M1-T3** (K2 "now").
- M1-T3: request `hour` → loop adds `appHourNote(hour)` system note ("now" → `fromHour`, `toHour` user's or 24); dialog
  suffix "· starts now" when cap `fromHour` = store `timeIndex`; mock "cut/coupe <sector> now" → that proposal
  ("turn off / éteindre" still refused; FR refusal test now « Éteindre le marché maintenant »).
- Voice spectrum: `useVoiceInput` exposes `analyser` (FFT 4096) → `ui/voice-spectrum.tsx` (48 log bands 80 Hz–8 kHz, peak line,
  pitch zone), pure `utils/spectrum.ts`; checked with Chromium fake mic 1440/390 dark/light.
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
- Checks: `make check` ✓ (engine 209, web 602). Shots /simulation copilot tab 1440/390 dark/light ✓.

## Next task

- Commit M1-T3 + voice spectrum (two commits). `make e2e` (random nav timeouts here). Live check A53–A72. Then **M1-T4** (undo last change).

## Decisions taken

- Clinic guard + decision lock are code; the model is only told. Summary never carries energy numbers; sent as a system note saying numbers are not evidence.
- Audio is not stored; WAV only (Meta Voice), converted client-side. "Now" = app hour, told to the model as a note.

## Files touched this session

- Engine `safety.ts`; server `copilot/{loop,compaction,history,tools}.ts`, `providers/mock.ts`, `db/neon.ts`, api `copilot`,
  `sessions/[id]`, `voice`; web `features/copilot/**` (hooks, ui, utils), messages ×3; docs; scenarios A36, A50–A70.
- M1-T3: `server/copilot/{prompt,loop}.ts`, `providers/mock.ts`, `use-proposal-diff.ts`, messages ×3, tests, docs. Spectrum: see above.
