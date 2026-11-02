# PV-P — Free placement of inserted objects (plan)

**Why (user, 2026-11-01):** the « Sector » field is too static: it forces each object into one of the 6 existing
buildings. The operator wants to place an object exactly where it is in the village.
**Status:** ❌ planned. **Depends on:** PV-T11…T13 (insert, markers, list).

## Principle

Split **where it is drawn** from **which feeder it loads**:

- `position` (new, visual only): `{ x, z }` on the village map (scene units, inside the terrain). Drawn there in 3D and 2D.
- `sector` (kept): the feeder line that carries its load. Engine sectors stay fixed (6): the engine, strategies, copilot
  tools and the hash do not change. Default = **nearest sector** to the position; the operator can override it.
- Open question for later (not in this plan): new sectors / feeders = an engine change (`SECTOR_IDS`, strategies, i18n).

## Tasks

- [x] **PP-T1 Contract.** `ApplianceSchema.position?: { x: number, z: number }` (bounded to the terrain box), optional so
      old saves and the copilot keep working. Ignored by the load model; excluded from the result hash or included as
      metadata only. Test: parse with / without position, out-of-bounds refused. Docs: `contracts.md`, `engine-spec.md` (one line).
- [x] **PP-T2 Pure helpers** (`microgrid-3d/utils/placement.ts`, tested): `nearestSector(pos)` from `SECTOR_POSITIONS`;
      `clampToTerrain(pos)`; `snapAwayFromBuildings(pos)` (no marker inside a building footprint); `defaultPosition(sector, k)`
      = today's ring around the building (current markers keep their place).
- [x] **PP-T3 Markers.** `applianceMarkers` uses `position` when set, else `defaultPosition`; ground height from `terrainHeight`;
      a thin cable line from the marker to its sector building (shows which feeder it loads). 2D diagram: dot at the projected
      position + the same link. Budgets: still 3–4 draw calls for 30 markers.
      (Done 2026-11-02: `feeder` anchor on the marker model, one batched LineSegments2 for all links; ring consts moved to
      `placement.ts`, site positions to leaf `site-positions.ts` — the first wiring created an import cycle that crashed module
      evaluation. 2D dot deferred to PP-T4: the 2D diagram is a schematic with no map projection; the minimap defines it.)
- [x] **PP-T4 Place by click.** In the insert form, the « Sector » select becomes « Position » + « Feeder »:
      button « Place on the map » opens a top-down minimap (2D SVG of the village, same projection as the 2D diagram,
      keyboard: arrows move a cursor, Enter places) → click sets `position`, feeder = nearest (label « nearest: Water pumping »),
      editable select « Feeder » for an override. Touch targets ≥ 44 px, works at 320 px.
- [ ] **PP-T5 Drag in 3D.** On /village and /simulation, a selected marker can be dragged on the terrain (raycast on the ground
      plane, `invalidate()` on move, no setState per frame: commit on pointer up). Feeder follows the nearest sector unless it was
      overridden. Undo with the existing « Remove » / edit flow.
- [ ] **PP-T6 AI suggestion.** `aiDraft` keeps suggesting the sector; position default = ring around it. (Optional: map the
      photo box to a position when the photo is a village view — out of scope until a camera calibration exists.)
- [ ] **PP-T7 Copilot.** Tools report the feeder, never invent positions; `position` passes through unchanged.
- [ ] **PP-T8 Docs + scenarios.** `docs/design/screens/village.md`, `components.md`, i18n keys ×3, `test-scenarios/06-village.md`
      (place, override feeder, drag, mobile, dark/light), README feature line.

## Done when

An object can be put anywhere on the terrain from the form (minimap) and by dragging in 3D; its load still goes to one
of the 6 feeders (nearest by default, overridable); the engine results are identical for the same feeders; tests pass.
