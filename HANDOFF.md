# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-30 · **By:** Claude Code · **Branch:** `feat/meta-models` · **PR:** none yet · **Uncommitted work below**

## State

- Plan `docs/tasks/PM-meta-models.md`. PM-M0 done (except human M0-T1 Malagasy speech test). **M1-T1 done.**
- **M1-T1 (K1):** engine `changeImpact(before, after)` + `ChangeImpactSchema` (`metrics/impact.ts`, `schemas/impact.ts`):
  served kWh before/after/delta + off hours per sector, SoC min, unserved kWh. `propose_change` simulates current vs
  patched input (active vs proposed strategy), rounds, keeps changed sectors, sends `proposal.impact` + same numbers as
  evidence. Dialog block "Engine calculation" (`proposal-impact.tsx`, grid table, label on own line < sm).
- **Generated images persist:** route uploads each `image` event to R2 (`server/storage/media.ts`
  `storeGeneratedImage`) and saves it in assistant `media` (`generated`, `key`). Session GET re-signs every media key
  (`hydrateMessageMedia`) and puts the image back in `imageUrl`. R2 off + Neon → not saved (no base64 in Postgres).
- **History tokens:** `compactHistory` (`server/copilot/history.ts`): last 8 msgs, media only on latest user msg,
  older answers cut to 600 chars. Client sends ≤ 8 (`COPILOT_HISTORY_LIMIT`). Log line `History sent: …`.
- **Model picker** always defaults to Auto (models route `activeModel: 'auto'`, hook forces `auto`).
- Checks: `make check` ✓ (engine 205, web 544), i18n ✓, prettier ✓. Dialog screenshots 1440/390 dark/light ✓.
- Note: mock prompt "coupe le marché ce soir" (18–21 h) → "no change" in baseline (market has no evening demand).

## Next task

- Commit (not done: user didn't ask yet). Live check A39–A49 with Meta key + R2 + Neon.
- Then **M1-T2** (K6 clinic guard: cut / floor 0 on `health` → red warning + second confirmation).
- Ideas not done for tokens: server-side history from Neon (client sends only last msg), summary of old turns.

## Decisions taken

- Impact numbers come from the engine (`changeImpact`), rounded in the tool only; UI just formats.
- Generated images are never sent back to the model; older photos neither (only the latest user message routes to vision).
- No keyword routing with Meta; contributor on by default (simulated data only).

## Files touched this session

- Engine: `metrics/impact.ts`, `schemas/impact.ts`, barrels, `__tests__/impact.test.ts`
- Web: `server/copilot/{tools,loop,history}.ts`, `server/storage/{r2,media}.ts`, `app/api/copilot/{route,models/route,
upload/route,sessions/[id]/route}.ts`, `features/copilot/{types.ts,ui/{confirm-proposal-dialog,proposal-impact}.tsx,
hooks/use-copilot.ts,utils/{history,format-telemetry-channel}.ts}`, `lib/format.ts`, `messages/{en,fr,mg}.json`, tests
- Docs: `contracts.md`, `engine-spec.md`, `copilot.md`, `architecture.md`, `design/stitch-map.md`, `tasks/PM-meta-models.md`
- test-scenarios (local): A41–A49
