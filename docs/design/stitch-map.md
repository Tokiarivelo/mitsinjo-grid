# Stitch mockup map — one row per screen/surface

Mockups are exported **once** to `design/stitch/` (committed) so agents read a local PNG (~1–2k tokens)
instead of calling the Stitch MCP every time. Use the MCP only to generate, refresh or export.

| Surface         | Route / scope         | Spec                       | Stitch screen id                 | Export                                          | Status   |
| --------------- | --------------------- | -------------------------- | -------------------------------- | ----------------------------------------------- | -------- |
| Live Simulation | /simulation           | screens/live-simulation.md | 2cf782dffaed4ee69a889c7f4cbcb003 | `design/stitch/live-simulation.png` (+ `.html`) | exported |
| Overview        | /overview             | screens/overview.md        | 060970653b394197a26b4e4997703260 | `design/stitch/overview.png` (+ `.html`)        | checked  |
| Strategy Lab    | /strategies           | screens/strategy-lab.md    | bfbfa25691fe45f2b5af82216ceb242c | `design/stitch/strategy-lab.png` (+ `.html`)    | checked  |
| AI Copilot      | /copilot + side panel | screens/copilot.md         | b5ff63b413004edca491b83aadfe9f08 | `design/stitch/copilot.png` (+ `.html`)         | checked  |
| Scenarios       | /scenarios            | screens/scenarios.md       | d0c1f73e58cb428989306f98803e2a11 | `design/stitch/scenarios.png` (+ `.html`)       | checked  |
| App shell       | sidebar/header/panel  | shell.md                   | (from any screen)                | crop of `live-simulation.png`                   | exported |
| UI kit          | components/ui         | components.md              | —                                | none (derive from screens)                      | —        |

Stitch project id: `4259585850792174155` (Design System asset: `assets/d762353e27224da2a6e34c396b0f78df`).
Status values: `not generated` · `generated` · `exported` · `implemented` · `checked` (passed /design-check).

## Reference visual assets (Ground truth)

- Master Village Sunset Reference: `design/reference/Mitsinjo Grid_ Village at Sunset.png`
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
- Overview: 2-column Bento Command Center (col-span-7 Left / col-span-5 Right). Docked 4-stat Energy Balance summary strip sits directly beneath the 3D digital twin viewport; 24h telemetry chart underneath; right column hosts Service Allocation hierarchy and computed Scenario Impact / Copilot insights. No fake weather telemetry (precedence 1).
- Strategy Lab: decision summary sits above the cards (read before comparing) instead of bottom-right; no "Recommended" ribbon — the summary's "Use this strategy" action plays that role.
- Live Simulation 3D: look follows `design/reference/Mitsinjo Grid_ Village at Sunset.png` (stylized low-poly, not photoreal; no in-scene text such as the "École" sign, i18n rule). Golden-hour light by day, night by night: the reference's permanent sunset would hide the time-of-day signal.
- Strategy Lab: no fixed-inputs tile strip; scenario, PV and battery are one line under the title (values from `input`).
- Strategy Lab: comparison is one grouped Recharts bar chart, not per-metric bar rows; mixed units are labelled in the card header.
- Gate-out 2026-10-27 (after PR #3 fixes): sidebar status badges wrap inside the sidebar; EnergyBar header wraps in narrow cards.
- Gate-out P5 2026-10-27: Live Simulation features interactive village topology + timeline scrubber + BuildingInspectorPanel + SimControls inline with Zod validation. Scenarios library provides 5 synthetic scenario cards, assumptions inspector, and latest-run reproducibility summary with JSON and markdown exports. Both screens pass 1440x900 screenshot gate with 100% i18n parity.
- Gate-out P6 2026-10-27: AI Copilot features two-column operational deck on /copilot and 360px panel mode across all screens. Includes structured ChatMessage (What happened, Computed evidence, Why it matters, Explore next), ToolActivity bar, interactive ConfirmProposalDialog with diff preview and operator approve/reject, suggested prompt chips, and neutral computed ContextPanel. In context panel: no fake temperature/humidity/irradiance since engine has no weather sensors (precedence 1); canonical input parameters shown instead. Matches 1440x900 screenshot gate with 100% i18n parity.
- Gate-out P7 2026-10-27: 3D Microgrid digital twin on /simulation with smooth OrbitControls, 4 camera presets (Village, Solar, Battery, Essential), reset camera button, 5 canonical sector buildings with HTML status badges, BESS battery container with 5-bar LED gauge, solar array with emissive glow, overhead lines with catenary curves and animated energy flow. Overview features compact 3D/2D digital twin preview. Both support SSR fallback and graceful WebGL-unavailable 2D topology fallback without crashes. Matches 1440x900 screenshot gate with 100% i18n parity.
- Gate-out P7 3D 2026-10-27: `make scene-audit` → `design/shots/{simulation,overview}-3d.png` (SwiftShader WebGL). Scene matches canonical layout; 97 draw calls, 6.2k triangles. Deviation: sector mirror bar is a single scrollable row above the hint (was overlapping it).
- Live Simulation Redesign 2026-10-27 (Screen `2cf782dffaed4ee69a889c7f4cbcb003`): 3D microgrid digital twin expanded to dominant centerpiece (~75% width, full height). Secondary dashboard cards consolidated into collapsible right drawer (380px) organized into 4 category tabs (Métriques, Contrôles, Bâtiments, Copilote IA). 24h Time Cursor ('Curseur Temporel 24h') kept permanently docked outside tabs at bottom of 3D viewport.
- PX/PY 2026-10-27 (PR #15): no mockup for stretch elements. ImpactBanner `ANOMALY_TO_VERIFY` (ai-violet, "to verify" wording) and `SECTOR_CAPPED` (energy-cyan); SimControls "Sector priorities & caps" row; cap badge in AssumptionsInspector; priority/cap rows in ConfirmProposalDialog diff. Existing tokens only; cap values via i18n `common.capRange`. Screenshot gate not run.
- Strategy Lab parameters 2026-10-28 (PZ phase 1): built without mockup by owner decision, design system only.
  `StrategyParamsPanel` above the decision summary; checked 1440×900, 390×844 and 320 px, dark and light, no horizontal overflow.
- EMS dispatch feeders 2026-10-29: 3D badge moved in front of the shelter, below roof level (it hid the battery); sector cables leave from 6 roof risers; kW tag on each cable; share bar (one segment per sector) in the 3D badge and both 2D EMS cards. Topology: hub → EMS → bus. Circuit: bus bar + breakers inside a dashed EMS switchboard frame, kW tag per feeder. Controller camera moved to [-2, 8.5, 11.5] (closer view made labels huge). Legacy hub transformer/mast removed from `terrain.tsx`.
- PR #28 follow-ups 2026-10-30: 3D EMS badge re-anchored (centered on the shelter front at breaker height, same scale as the other building labels) instead of hanging below the pad. 2D Topology/Circuit: zoom/pan + full screen; HUD clearance fixed (`sm:p-4` used to override the top/bottom padding, so the legend overlapped the hint). Checked 1440×900 and 390×844.
- Weather workflow 2026-10-28: built without mockup (no Stitch screen). `WeatherWorkflowPanel` in Controls tab + `DayStrip` above the timeline, reusing strategy-button selected style as rounded pills. Checked 1440×900 and 390×844, dark and light, no horizontal overflow.
- EMS Dispatch Controller 2026-10-29 (PL phase 2): built with design system tokens and canonical 3D low-poly technical shelter at BUS_POSITION [0, 0, 1]. Controller card in 2D topology and circuit diagram with breaker + current limiter symbol; camera preset 'controller'; 100% i18n key parity across EN, FR, MG; checked 1440×900, 390×844 and 320 px, dark and light, no horizontal overflow.
- Strategy Lab survival floors 2026-10-30 (PL-T17): built without mockup, same pattern as the critical-shares block
  (sector caption + `SimControl` per sector). Checked 1440×900 and 390×844, dark and light, no horizontal overflow.
- Live Simulation scale-model panel 2026-10-30 (PH-H4): built without mockup, same card pattern as Weather Workflow;
  label–value rows (2 columns were too tight in the side panel). Checked with a live bridge at 1440×900 and 390×844,
  dark and light, no horizontal overflow.
- M1-T1 2026-10-30: no mockup. ConfirmProposalDialog gains an "Engine calculation" block (`proposal-impact.tsx`): energy-cyan border like Computed evidence, grid table Before / After / Change; on < sm the label takes its own line above the 3 values. Negative change `critical-red`, positive `battery-green`. Gate-out: dialog screenshots 1440 + 390, dark + light, no horizontal overflow.
