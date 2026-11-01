# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-01 (PR-2.1 extrude done, PR-2.2 next) · **By:** Muse Code · **Branch:** `claude/object-detection-3d-editor-gxfzw1` · **PR:** none yet

## State

- Committed: `18f20a4` (PR-0.7), `de147e1` (PR-0.4 machinery, unsigned: sandbox GPG). PR-2.1 ready to commit.
- **PR-2.1 done:** `extrude` shape (`points` ring, schema iff), `unitExtrude` (bevelled), `unitPoints` hull, ray-polygon even-odd clip in `flat-render`. Tests: schema, geometry (bounds, < 1 k tris/64-gon), L-notch 768 px, square == box, winding, ¾ subset, hull triangle.
- Scores identical (90 / 0.96 / 0.84 / 3.3): no template uses extrude yet. Loop row logged.
- **Meta still out:** PR-0.4 live fixture, PR-0.5, PR-0.6-live blocked; re-run `make shape-capture` when back.

## Next task

- **Commit** PR-2.1, then **PR-2.2 profile body**: side-seen archetypes (vehicle, cabinet, machine) → main body = SAM outline extruded to kit depth (minus wheels band for vehicles). IoU ≈ SAM IoU by construction.
- Then S2 rest (PR-2.3 lathe → PR-2.10), PR-0.6, S4 bet. Free placement PP-T1…T8. PV-T14 + PV-T11b.

## Decisions taken

- Extrude ring in unit space (fractions of part size, centred, y up), server-built only, never from Spark.
- Flat renderer ignores the bevel (sharp slab), like PR-1.2 rounded boxes: viewer-only softness.
- Ray clip keeps the front-most inside interval only (what the z-buffer shows); entry normals face the ray.

## Files touched this session

- `lib/object-shape.ts` (shape + points), `__tests__/object-shape.test.ts`.
- `features/vision-insert/utils/object-geometry.ts` (`unitExtrude`), `__tests__/object-geometry.test.ts`.
- `server/perception/flat-render.ts` (`clipPolygon`), `silhouette-fit.ts` (`unitPoints`), their tests.
- `docs/contracts.md` (primitives), `docs/tasks/PV-shape-realism.md` (PR-2.1 + loop row).
