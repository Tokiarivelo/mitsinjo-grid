---
name: shape-3d
description: Build or change the 3D model of one detected object (photo → kit → parts → mesh) on /village — templates, primitives, measurements on the photo, materials, the server shape pipeline and the 3D editor viewer. Use for work in lib/object-*, server/perception shape files, or features/vision-insert 3D geometry.
---

Implementer for the object 3D model. Plans: `docs/tasks/PV-shape-realism.md` (current), `PV-shape-fidelity.md` (done).
Judge every change with `/shape-loop`.

**Hard rules**

1. Meta models only (Muse Spark / Wonder, Muse Image, SAM 3.1). No other AI vendor.
2. Never paste or project the photo on the model. Allowed: colours measured on it, and small tileable swatches
   (≈ 64 px) cut from it as material textures.
3. Spark says **what** (archetype, sub-type, materials, counts); pixels say **how it looks** (outline, colours, roof,
   repetition, yaw, part masks). Measurements win by confidence (`fusion.ts`).
4. Shape math is pure, seeded TS in `server/perception/` (no `Math.random`), ≤ 300 ms per object; every function has
   a Vitest test; a fixed bug gets a regression test (« before: … »).
5. ≤ 5 k triangles and ≤ 12 parts per object; one merged geometry, groups per material.
6. No energy value anywhere in this pipeline.

**Map (read barrels first, then only what the task names)**

| Layer                       | File                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| Kit schema, templates       | `apps/web/src/lib/object-kit.ts` (`TEMPLATES`, `facade`, `kitToRecipe`)                               |
| Recipe schema, fit to box   | `apps/web/src/lib/object-shape.ts` (`RecipePart`, `fitRecipe`, materials)                             |
| Spark prompt / parse        | `server/perception/shape.ts` (`SHAPE_SYSTEM_PROMPT`, `SHAPE_JSON_SCHEMA`, `parseKit`)                 |
| Pipeline                    | `server/perception/object-shape.ts` (`runObjectShape`, logs `[vision] 3D …`)                          |
| Measurements                | `color-measure`, `shape-colors`, `roofline`, `repetition`, `perspective`, `silhouette-fit`, `fusion`  |
| Viewer geometry / materials | `features/vision-insert/utils/object-geometry.ts`, `utils/surface-look.ts`, `ui/object-editor-3d.tsx` |
| Golden set                  | `server/perception/__fixtures__/shape/`, `__tests__/golden-shape.test.ts`, `make test-shape`          |

**Adding things**

- A primitive: unit builder in `object-geometry.ts` (non-indexed, uv + normal like the others) **and** its outline
  points in `silhouette-fit.ts` `unitPoints`, plus `RECIPE_SHAPES`. Test vertex count and bounds.
- A template / sub-type: role colours only (`c.main/secondary/accent`), main body first, ≤ 12 parts; golden case.
- A measurement: pure function + confidence in `fusion.ts` + one log field; never trust it below its confidence.
- Contract change → `docs/contracts.md`; prompt / model change → `docs/copilot.md`; visible change → scenario in
  `test-scenarios/06-village.md`.

**Done =** `make test-shape` green, `/shape-loop` row logged with no metric regressed, typecheck + lint + i18n.
