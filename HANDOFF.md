# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-04 · **By:** Claude Code · **Branch:** feat/pt-0-1a-baseline-hull-bevel (pushed, no PR yet)

## Current state

- Plan `docs/tasks/PT-studio-look.md`: PT-11 merged; **PT-0 + PT-1a done** on this branch.
- PT-0 baseline logged (Loop log): IoU 0.98, edge F1 0.91, ΔE 3.4, designer 3/5; village high 192–209 calls,
  low 143–148 calls (fps from the dev server: 10–25 high / 17–26 low, not a prod measure).
- PT-1a: `EDGE_BEVEL` (0.06 of the smallest side) + `edgeBevel(w, h, d, radius)` (capped by
  `SURFACE_LOOK.radius`) in `object-geometry.ts`; `unitHull(…, bevel?)` adds one inset ring per end
  (`bevelHullEnds`), + 4 × n triangles, bounds unchanged. Only hull **bodies** (`front`), no `axis`.
- Shape report unchanged (no report fixture uses a hull body → proven by 4 new tests only).

## Next

1. PT-1b: `cylinder` / `cone` → `unitLathe` on a chamfered profile, size from `edgeBevel`.
2. Then 1d (silhouette body) → 1c (prism) → PT-3 → PT-2… (order in the plan).

## Files touched

- `apps/web/src/features/vision-insert/utils/object-geometry.ts`, `__tests__/object-geometry.test.ts`
- `docs/tasks/PT-studio-look.md` (ticks + Loop log); `test-scenarios/06-village.md` V171 (local)

## Decisions

- Bevel passed to unit geometry per axis (`b / sx`, `b / sy`, `b / sz`) so it stays even once scaled.
- End loop moves in by ≤ half the gap to its neighbour, so slices never cross.
- Skin patches (glass, grille, cell lines) keep sharp edges.

## Known limits

- No shape-report fixture exercises the hull path; add one (2D-view car) if a visual check is needed.
- `region-colors.test.ts` "golden car" can time out (5 s) under load; passes alone.
