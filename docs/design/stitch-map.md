# Stitch mockup map — one row per screen/surface

Mockups are exported **once** to `design/stitch/` (committed) so agents read a local PNG (~1–2k tokens)
instead of calling the Stitch MCP every time. Use the MCP only to generate, refresh or export.

| Surface         | Route / scope         | Spec                       | Stitch screen id                 | Export                                          | Status   |
| --------------- | --------------------- | -------------------------- | -------------------------------- | ----------------------------------------------- | -------- |
| Live Simulation | /simulation           | screens/live-simulation.md | 918a9f74799f4589a0487afa4adfd474 | `design/stitch/live-simulation.png` (+ `.html`) | checked  |
| Overview        | /overview             | screens/overview.md        | 060970653b394197a26b4e4997703260 | `design/stitch/overview.png` (+ `.html`)        | checked  |
| Strategy Lab    | /strategies           | screens/strategy-lab.md    | bfbfa25691fe45f2b5af82216ceb242c | `design/stitch/strategy-lab.png` (+ `.html`)    | checked  |
| AI Copilot      | /copilot + side panel | screens/copilot.md         | b5ff63b413004edca491b83aadfe9f08 | `design/stitch/copilot.png` (+ `.html`)         | exported |
| Scenarios       | /scenarios            | screens/scenarios.md       | d0c1f73e58cb428989306f98803e2a11 | `design/stitch/scenarios.png` (+ `.html`)       | checked  |
| App shell       | sidebar/header/panel  | shell.md                   | (from any screen)                | crop of `live-simulation.png`                   | exported |
| UI kit          | components/ui         | components.md              | —                                | none (derive from screens)                      | —        |

Stitch project id: `4259585850792174155` (Design System asset: `assets/d762353e27224da2a6e34c396b0f78df`).
Status values: `not generated` · `generated` · `exported` · `implemented` · `checked` (passed /design-check).

## Reference visual assets (Ground truth)

- Master Dashboard Mockup: `design/reference/tableau-de-bord-solaire-futuriste.png`
- Village 3D & 2D Schematic: `design/reference/village-3d-2d-schema.jpg`
- Village 3D Viewport Crop: `design/reference/village-viewport-reference.png`
- Village 2D Circuit Schema: `design/reference/village-2d-schema.jpg`

## Precedence when sources disagree

1. `docs/contracts.md` + engine data (what values exist) — never fake a field to match a mockup.
2. `docs/design/*.md` rules (color semantics, labels, states, a11y, "no fake controls").
3. Stitch mockup (layout, spacing, hierarchy, visual feel).
   Record each deviation from the mockup in the Notes below with a one-line reason.

## Notes / deviations

- Overview: no telemetry strip (temp, RH, DNI, sync, grid V) — engine has no such fields (precedence 1).
- Overview: no AI optimization panel — AI text lives only in copilot components; a computed InsightCard is used instead.
- Overview: right column of the middle row is a 24h Energy Balance card; Service Allocation moved under it (same data, fits 1440×900).
- Strategy Lab: decision summary sits above the cards (read before comparing) instead of bottom-right; no "Recommended" ribbon — the summary's "Use this strategy" action plays that role.
- Strategy Lab: no fixed-inputs tile strip; scenario, PV and battery are one line under the title (values from `input`).
- Strategy Lab: comparison is one grouped Recharts bar chart, not per-metric bar rows; mixed units are labelled in the card header.
- Gate-out 2026-10-27 (after PR #3 fixes): sidebar status badges wrap inside the sidebar; EnergyBar header wraps in narrow cards.
- Gate-out P5 2026-10-27: Live Simulation features interactive village topology + timeline scrubber + BuildingInspectorPanel + SimControls inline with Zod validation. Scenarios library provides 5 synthetic scenario cards, assumptions inspector, and latest-run reproducibility summary with JSON and markdown exports. Both screens pass 1440x900 screenshot gate with 100% i18n parity.
