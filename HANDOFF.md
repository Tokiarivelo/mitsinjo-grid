# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-04 · **By:** Claude Code · **Branch:** feat/pt-11-object-tag (worktree `../mitsinjo-grid-pt`)

## Current state

- New plan `docs/tasks/PT-studio-look.md` (from the `elvarofficial/teardown` study): studio look for every
  object (soft edges, softbox light, clearcoat, ink outline, shader warm-up, real sizes) + PT-11 object tag.
- **PT-11 done:** an inserted object's 3D tag is now the buildings' badge (`ui/scene-badge.tsx`): category icon on
  the sector colour, name × quantity, status dot, sector priority (critical in red) · kW now, beacon above, click
  selects. Tested; gate-out shots 1440 + 390, dark + light (sample-room fridge on /simulation).
- Demo video work (PD) is merged in main; nothing pending there.

## Next

1. PT-0 baseline (`make shape-report`, `SHOT_SUFFIX=before make shape-shots`, `make scene-audit-gpu`), log numbers.
2. PT-1a (bevel the 2D-view hull caps) → 1b → 1d → 1c, then PT-3, PT-2… (order in the plan).

## Files touched (PT-11)

- `features/microgrid-3d/ui/scene-badge.tsx` (new), `buildings.tsx`, `appliance-markers.tsx`, `village-canvas.tsx`
- `features/microgrid-3d/utils/appliance-markers.ts` (`applianceTagState`), `to-scene-model.ts`
- `features/microgrid-3d/hooks/use-marker-drag.ts` (`toggleSelect`)
- `components/ui/appliance-icon.tsx` (new), `sector-icon.tsx` (`SECTOR_ICON_BG_CLASS`), `index.ts`
- `messages/{en,fr,mg}.json`: `applianceTag` → `applianceBadgeTitle` (ICU plural)
- Docs: `contracts.md`, `design/3d-scene.md`, `design/stitch-map.md`, `tasks/PT-studio-look.md`, `tasks/README.md`

## Decisions

- An appliance has no priority of its own: the badge shows its **sector's** (no engine change, no migration).
- Status: idle when the object draws 0 kW or its sector is off, else the sector's served colour.
- Badge scale × `APPLIANCE_FOCUS_SCALE` (0.6): focused object = focused building size; a bit smaller in the overview.
- All beacons in one `Instances` (+1 draw call total). `MARKER_TAGS_ALL_MAX` (6) kept for DOM cost.

## Known limits

- At 390 px a focused badge can sit under the floating HUD at the top of the 3D view (buildings already did).
- `region-colors.test.ts` "golden car" can time out (5 s) under load; passes alone.
