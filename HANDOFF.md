# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-01 (PR-2.19–2.21 done, PR-2.12 new next) · **By:** Muse Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Committed through `bf76578` (PR-2.11). Uncommitted: PR-2.19/2.20/2.21 (1 atomic commit, cross-dependent). Standing: commit each, unsigned fallback, always continue.
- **PR-2.19 done:** `BOX_COLOR_CONFIDENCE_MAX = 0.3` — box-only colour mixes cap at 0.3 (Spark leads). Fusion + box-only e2e tests; goldens identical.
- **PR-2.21 done:** `CONCEPT_NOUNS` — SAM concepts normalized (EN+FR, phrases first, guarded). conceptOf takes `{label}`; refine/grouping tests; goldens identical.
- **PR-2.20 done:** `fetchOutlineForBox` — outline-less shape targets segmented on demand (full photo, normalized concept, IoU ≥ 0.3, box kept), sampling awaits it (usually free). Unit + e2e tests; goldens identical.
- **PR-2.11 done:** `TAIL_LIGHT_COLOR` fixed red (kitToRecipe passthrough); sedan −2 invisible bumpers +2 lenses, van/pickup −front bumper, bike none; all ≤ 12. Goldens identical (car 93); rear renders red (136/37 px).
- **PR-2.10 done:** `withMaskChimney` — min-area rect per chimney mask (tilt ≤ 20°, yaw ≤ 0.3, ≤ 2), feet at eave, top follows mask (≥ ridge + 0.02), template replaced, decals fund room. Cottage e2e IoU 0.98 → 0.96; mean 93.
- Loop lessons: global band cut punched the middle (−3 %); shrink-then-expose buried glass; squeeze must use world units (frame h·aspect); pixel-count confidence is perverse without an outline.
- **Meta still out:** PR-0.4 live fixture, PR-0.5, PR-0.6-live blocked.

## Next task

- **Commit** PR-2.19/2.20/2.21 (3× `feat(web)`), then **PR-2.12 house backs + yaw gates** (mirror house panels to back; unify 0.26/0.3 gates; 17–60° near-only; then loop pass → PR-2.13).
- User ordered: do ALL planned tasks, then a full image-recognition + imagined-3D investigation.
- **PR-2.9 done:** `part-fit.ts` — coordinate descent, keep iff +0.05. Car 93 → 93; car math 174 → 257 ms; mean 93.
- **PR-2.8/2.7/2.6/2.5/2.4 done:** region colours, mask panels, mask wheels, part masks, lathe body. Mean 93 throughout.
- Then PR-2.13, PR-0.6, S4 bet. Free placement PP-T1…T8. PV-T14 + PV-T11b.

## Decisions taken

- Slab yields to plates (notch to old box top when straddling) and wheels (wells up to wheel tops); yaw gate 0.26 rad + feasibility bail.
- fit.iou re-scored after profiling (shipped silhouette ≠ fitted template); silhouetteRings largest-first reused, no duplication.
- Plan refined from archi workflow (2026-11-01): target pipeline + skills map in PV-shape-realism.md; new PR-0.8, PR-2.14–2.16; Blender/GLB/VGGT out.
- Scene/status/parametric rules adopted: unified 4 statuses, PR-2.17 real openings, PR-2.18 `applyEdit`; LLM = params only, engine builds all geometry.
- Green-Mini chain: no outline → box-only sampling → c=1.0 → hedge wins. Fixed by 2.19 (cap) + 2.20 (fetch) + 2.21 (nouns).

## Files touched this session

- `fusion.ts` + `fusion.test.ts` (2.19); `outline.ts` + `outline.test.ts` (2.20/2.21).
- `object-shape.ts` + `object-shape.test.ts` (wire 2.20, cap site, call-list update); `region.test.ts` (pump).
- `docs/tasks/PV-shape-realism.md` (3 ticks + 3 log rows), `test-scenarios/06-village.md` (V73).
