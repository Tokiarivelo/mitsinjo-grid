# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-30 · **By:** Claude Code · **Branch:** `feat/meta-models` (from `main` after PR #30) · **PR:** none yet

## State

- Plan `docs/tasks/PM-meta-models.md` (voice, vision, SAM, image, chat control, fire alarm), ideas in
  `docs/ideas-meta-models.md`. **PM-M0 done** except the human part of M0-T1 (Malagasy speech test).
- `server/perception/`: Meta + deterministic mock for `transcribe`, `analyzeImage`, `segmentImage`; never throws
  (`fallback` field). `server/spend/`: per-session cap `META_SPEND_CAP_USD` → mock + `PROVIDER_FALLBACK reason: spend_cap`.
- **Model choice by Spark tool calls** (`server/copilot/model-tools.ts`): `generate_image` (Muse Image, numbers stripped),
  `segment_image` (SAM on the attached photo, `perception` SSE event), `escalate_deep_reasoning` (Wonder for the rest of
  the turn). `adaptive-router.ts` keeps only structural rules (explicit model, attached image → vision). Mock imitates
  the choice with keywords (offline only). Prompt rule 6b in EN/FR/MG.
- **Contributor preferred** (`providers/contributor.ts`, `META_PREFER_CONTRIBUTOR=true` default): chat + vision use
  `muse-spark-1.3-contributor`; 403/404/429 → resend on standard id, pause (60 s / 1 h). Spend guard bills the id that answered.
- Checks: web 513 ✓ (simulation test once timed out under full-suite load, passes alone), typecheck ✓, lint ✓, i18n ✓,
  prettier ✓. Engine `sweep.test.ts` perf budget fails on this machine (pre-existing).
- **Not verified live:** tool choice by the real Spark + contributor access (dev server commands were not permitted).
  Run test-scenarios A30–A38 with `make dev`.

## Next task

- Live check A30–A38, then **M1** (chat control + approval with engine impact).
- M0-T1 human part: record FR + Malagasy WAV phrases, verdict "MG usable".

## Decisions taken

- No keyword routing with Meta: Spark decides through tools; code keeps only structural rules and safety (spend cap).
- Contributor on by default per user (cost); data is simulated. Turn off for real user data (Meta trains on it).
- Image generation stays in `providers/meta.ts` (reused). Perception numbers are observations, never engine values.

## Files touched this session

- Web: `lib/env.ts`, `server/{perception,spend}/**`, `server/copilot/{adaptive-router,model-tools,loop,prompt,provider}.ts`,
  `providers/{meta,mock,contributor}.ts`, `app/api/copilot/route.ts`, `features/copilot/ui/tool-activity.tsx`,
  `messages/{en,fr,mg}.json`, tests
- Docs: `copilot.md`, `contracts.md`, `architecture.md`, `setup/env.md`, `tasks/{README,PM-meta-models}.md`,
  `ideas-meta-models.md`, `.env.example` · test-scenarios A30–A38 (local)
