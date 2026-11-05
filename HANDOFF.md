# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-04 · **By:** Claude Code · **Branch:** feat/pt-10-close (stacked chain, all pushed, no PRs yet)

## Current state

- Plan `docs/tasks/PT-studio-look.md` done except **PT-7** (open, see Known limits).
- One branch per task, each stacked on the previous one (merge in this order, each into `main`):
  `feat/pt-1b-chamfered-lathe` (1b, 1d, 1c) → `feat/pt-3-clearcoat` → `feat/pt-2-softbox-studio` →
  `feat/pt-4-ink-effect` → `feat/pt-5-editor-ink` (+ 1e) → `feat/pt-7-shader-warmup` → `feat/pt-6-village-ink` →
  `feat/pt-8-size-ranges` → `feat/pt-9-render-checklist` → `feat/pt-10-close`.
- `make check` green (2097 tests); shape report unchanged (IoU 0.98, edge F1 0.91, ΔE 3.4) at every step.
- GPU audit (GTX 960M): draw calls 192 / 209 high, 143 / 148 low, unchanged; fps unchanged.

## Next

1. Open PRs for the chain (or one PR from `feat/pt-10-close`), review, merge.
2. PT-7: profile the ~1.2 s long task when the village canvas mounts (forest / geometry build?), then tick.

## Files touched

- `vision-insert/utils/object-geometry.ts` (roundProfile, unitBevel, inset `unitExtrude`, prism, silhouette bevel)
- `vision-insert/utils/surface-look.ts` (clearcoat, `surfaceMaterial`), `utils/studio-env.ts` (new)
- `vision-insert/ui/object-editor-3d.tsx` (studio, composer + ink, warm-up fade)
- `microgrid-3d/utils/ink-effect.ts`, `ui/ink.tsx`, `hooks/use-shader-warmup.ts` (new); `ui/post-effects.tsx`,
  `ui/village-canvas.tsx`; `app/globals.css` (`--theme-scene-ink`)
- `lib/object-kit.ts` (`ARCHETYPE_SIZE_MM`, `clampEstimatedDepth`), `server/perception/shape.ts`
- `scripts/object-viewer-shot.mjs` (`SHOT_WIDTH`, `SHOT_LOG`), Makefile help
- Docs: task file + Loop log, `performance.md` § 5, `design/3d-scene.md`, `design/tokens.md`,
  `design/screens/village.md`, `.claude/skills/designer-3d/SKILL.md`. Scenarios V172–V180, T32 (local).

## Decisions

- Village ink: dark `scene-ink` token, silhouettes only, fade 22–45 units (text-primary + creases = white snow).
- Editor ink: `text-primary` (light in dark theme), crease weight 1; tone mapping moved into the composer.
- Prism bevel is an inset `unitExtrude` (bounds exact); no-bevel parts keep the old geometry.
- PT-8 clamps only Spark's depth (parseKit / critic patch), as ratios to height and width.

## Known limits

- PT-7: warm-up doesn't remove the first-mount long task (1.18–1.22 s without vs 1.22–1.32 s with).
- Light-theme editor ink is subtle on dark surfaces (dark on dark red); fine on the pale backdrop.
