# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-02 (PV-T9c done, PP-T5 next) · **By:** Muse Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Committed through PP-T4 (`fbff47b`); standing: commit each task, unsigned fallback (`-c commit.gpgsign=false`), always continue.
- **PV-T9c done:** free recipe for template-less archetypes (person/animal/bush/water/other); live-probed (12 parts, cut-case imagined).
- Verify: typecheck ✓, perception+lib suites ✓ (golden/model-score flake under load only), lint 0 errors, shape-report identical (mean 93).
- Uncommitted PP-T5 drag work in tree (hooks + placement + ring); **NOT MINE:** `server/storage/media.*`, `docs/setup/*.md` — never commit.

## Next task

- Commit PV-T9c files only (list in session), then **PP-T5 Drag in 3D** (`docs/tasks/PV-free-placement.md`): wire `useMarkerDrag`+`useMoveMarker` into `village-canvas.tsx`, UI tests, verify.
- Then PP-T6..PP-T8, PV-T11b + PV-T14. PR-0.5 needs 10 USER photos. S4 stopped.

## Decisions taken

- Free call runs under `model` step (no 4th dot); kit fallback on any failure; no rebuild/fit/critic over free recipes.
- `fitRecipe` preserves `source`; kit recipes stay sourceless (no `source: 'kit'` stamp).
- Coverage = cut photo edges only (honest, computable); meters-style proportions normalised at parse.

## Open questions / blockers

- Free recipes keep LLM colours (measured kit colours don't map to imagined parts) — swatches cover texture.
- SAM outline missed twice in probes (transient?); non-fatal by design.

## Files touched this session

- `server/perception/{free-recipe,backend,client,meta,mock,object-shape,spark-critic,shape-capture}.ts` + 14 test files.
- `lib/{object-shape.ts,__tests__/object-shape.test.ts}`, `docs/tasks/PV-vision-insert.md`, `.claude/skills/shape-3d/SKILL.md`.

## Gotchas

- `mixRecipe` swaps ALL parts at c≥0.5 — never run template-built fits over free recipes.
- Probe files (`zz-*.test.ts`) must be deleted before commit; `make format-changed` touches the whole tree — format own files only.
