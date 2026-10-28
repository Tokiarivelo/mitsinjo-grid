# Live Simulation

Route: /simulation. Goal: explore the microgrid and see how parameter changes affect distribution.
Reference visuals: `design/reference/tableau-de-bord-solaire-futuriste.png` (master UI mockup) and `design/reference/village-3d-2d-schema.jpg` (canonical village topology).
Scene spec: ../3d-scene.md. Shell: ../shell.md.

## Layout (Expanded 3D Twin & Toggleable Tabbed Deck)

The 3D visualization is the dominant centerpiece of the screen. To maximize 3D viewport visibility and eliminate visual crowding, all secondary telemetry, parameters, building inspector, and AI copilot blocks are consolidated into a collapsible right-side drawer with tab navigation. The 24h Time Cursor (`Curseur Temporel 24h`) is kept outside the tabs as a persistent bottom-docked controller on the 3D viewport.

```
+-------------------------------------------------------------------------------------------------------+
| Mitsinjo Grid | Live Simulation  [Baseline Village v] [SIMULATION COMPLETE]  [Reset] [Toggle Panel] [JD] |
+----------------------------------------------------------------------+--------------------------------+
| 3D Digital Twin Viewport (Dominant Canvas - ~72% to 100% width)      | Right Panel (Toggleable, 380px)|
|  - Full Village 3D Viewport (Sunset lighting, neon electric lines)    | +----------------------------+ |
|  - Camera Presets: [Village] [Solar] [Battery] [Clinic] [Reset]      | | [Tabs]: Metrics | Controls | |
|  - 3D/2D switch, fullscreen, grid overlay toggles                    | |         Inspect | Copilot  | |
|  - In-scene glassmorphic live HUD badges (kW, %)                     | +----------------------------+ |
|                                                                      | | TAB CONTENT:               | |
|                                                                      | |  [Active Tab Content]      | |
|                                                                      | |  - Metrics & Energy Charts | |
|                                                                      | |  - or Sim Parameters       | |
|                                                                      | |  - or Building Inspector   | |
|                                                                      | |  - or AI Copilot Insights  | |
| +------------------------------------------------------------------+ | |                            | |
| | Curseur Temporel 24h (Dedicated Bottom Dock / Floating Controller)| | |                            | |
| | [|<] [Play/Pause] [>|]  --o--------------------- [14:00 Peak Sun]| | |                            | |
| | [00h] [06h Sunrise] [12h Zenith] [18h Sunset] [24h]              | | +----------------------------+ |
| +------------------------------------------------------------------+ | [ < Hide Panel / Toggle ]      |
+----------------------------------------------------------------------+--------------------------------+
```

### Collapsible Panel & Full-Width 3D Mode

- When the right panel is expanded: 3D Viewport takes ~72% width, side deck takes ~28% (380-420px).
- When the right panel is collapsed (toggled off): 3D Viewport smoothly expands to 100% of workspace width. A floating button (`chevron_left` / "Open Deck") on the upper-right edge allows reopening the panel instantly.

### Persistent Curseur Temporel 24h (Bottom Dock)

- Positioned permanently at the bottom edge of the 3D viewport (above bottom padding, glassmorphic HUD pill).
- Independent of the right panel and active tabs: the operator can scrub any hour of the 24h simulation while inspecting the 3D scene, tweaking controls, or reading AI recommendations.
- Controls:
  - Transport buttons: Step Backward `[|<]`, Play / Pause toggle `[ > / || ]`, Step Forward `[>|]`, Stop `[■]` (pause + back to 00:00), Restart `[↺]` (from 00:00). Stepping or dragging the track pauses playback.
  - Playback state lives in the store (`play`/`pause`/`stop`/`restart`/`togglePlay`): one hour per 750 ms, looping over 24h. Editing inputs, loading or resetting a scenario stops it.
  - 24h interactive scrubber track with colored step markers (daylight solar hours in amber, night battery discharge in cyan).
  - Key milestone ticks: 00h (Midnight), 06h (Sunrise), 12h (Solar Zenith peak), 18h (Sunset), 24h (Night end).
  - Time badge readout: `14:00 • Daytime Solar Peak` with dynamic sun/battery icon.

---

## Right-Side Panel Categories (Tab Navigation)

The collapsible side deck contains four structured tabs:

### 1. Tab `Métriques & Énergie` (Telemetry & Charts)

- **Top Metric Cards (Compact Strip)**:
  - Solar Generation: `18.4 kW` (with mini amber sparkline, trend vs baseline).
  - Battery State: `78%` (46.8 / 60 kWh, gradient LED charge bar).
  - Community Demand: `22.7 kW` (92% served, cyan indicator bar).
  - Essential Services: `96%` (4/5 services satisfied, green badge).
- **Generation vs Demand (24h Chart)**:
  - Recharts composite chart showing Solar Generation (amber curve), Demand (cyan dashed), and Battery SoC % (green fill).
- **Energy Balance & Autarky**:
  - Net energy balance donut: `42.7 kWh` total served, autarky index `%`.
- **Service Allocation Breakdown**:
  - EnergyBar list for 5 canonical sectors (Clinic, Water pump, School, Houses, Market) with priority badges and unserved flags.

### 2. Tab `Paramètres & Contrôles` (Simulation Controls)

- **Scenario Selector**: Dropdown to select canonical scenarios (`Baseline Village`, `Solar Drop 50%`, `Overconsumption`, `Battery Outage`, `Clinic Emergency`).
- **Dispatch Strategy**: Radio / segmented select (`proportional`, `essential_first`, `balanced`).
- **Simulation Sliders**:
  - Solar multiplier (% scale, 0–200%).
  - Battery capacity (kWh, 10–150 kWh).
  - Initial SoC (% charge at 00:00, 10–100%).
  - Demand adjustment (% load factor, 50–200%).
  - Solar-drop start hour & duration (h; fixed 24h horizon).
- **Sector Priorities & Caps**: Collapsible toggle for sector power limits.
- **Weather Workflow** (below the controls card): ordered list of days (`Day 1`, `Day 2`… max 7), each with a
  radiogroup of 5 weather pills (Sunny, Partly cloudy, Cloudy, Rainy, Storm; icon + label, ≥ 44 px), a remove button
  (hidden when one day) and, after a run, `SoC end · unserved` per day. `Add day` copies the last day's weather.
  Multi-day totals (solar, unserved, battery min → end) under the list. Changing a day's weather after a run
  re-runs the engine at once (solar output, metrics and 3D update); before a run it only marks the scenario modified.
- **3D weather**: the viewport HUD shows the current day's weather (icon + name) and the scene renders it (see `3d-scene.md`).
- **Day strip** (multi-day only, above the 24h Time Cursor): one pill per day, current day pressed, red dot when that
  day has a critical deficit. Clicking a day pauses playback and shows that day's results; playback rolls over days.
- **Action Buttons**:
  - Primary button: "Run simulation" when there is no up-to-date result (runs the engine, then plays), else "Play" / "Pause". Stop and Restart appear once results exist. Same buttons in the page header and the Controls tab (`PlaybackActions`).
  - Secondary button: "Reset to baseline".
  - Status badge: `Scenario modified` (amber) / `Simulation complete` (green).

### 3. Tab `Inspection Bâtiments` (Building & Sector Inspector)

- **Sector Detail Card**:
  - Shows details for the currently selected village asset in the 3D scene (or defaults to Clinic).
  - Real-time demand (kW), served power (kW), coverage percentage (%), unserved energy (kWh).
  - Priority level (`P1 Essential`, `P2 Productive`, `P3 Flexible`).
- **Camera Presets Jump Bar**:
  - Quick focus buttons: `Village Overview`, `Solar Array`, `BESS Battery`, `Health Clinic & Water Pump`.
  - Camera reset button.
- **2D/3D Mode Switcher**:
  - View toggle (`ViewModeToggle`): 3D Scene · Topology · Circuit. Both 2D views are `GridDiagram`
    (`features/microgrid-3d`), driven by the same `SceneModel` as the 3D twin:
    - Topology = village plan (same relative places as 3D); Circuit = single-line diagram with a vertical
      bus bar and one breaker per sector (closed when powered, open + red when cut).
    - Powered wires show moving electrons; cut wires are red dashes with a break mark; no-demand sectors
      read "No load" (neutral). Legend under the diagram.
    - Every label has a reserved box (`utils/diagram-layout.ts`); tests assert no box overlaps another
      and no wire passes under a label.

### 4. Tab `Copilote IA` (AI Copilot & Insights)

- **Impact Banner**:
  - Contextual status alert (`Essential services fully supplied` / `Clinic supply below target` / `Battery reserve depleted`).
- **AI Operational Analysis**:
  - Structured reasoning card: What happened, computed evidence (canonical engine numbers only), and why it matters.
- **Actionable Proposal Chips**:
  - Quick action buttons (e.g. "Switch to Essential First strategy", "Cap residential to 60%") with interactive operator confirmation dialog (`ConfirmProposalDialog`).

---

## Data Bindings

- **Banner**: `metrics.criticalUnservedKwh > 0` -> "Clinic supply below target" / "Water pumping demand partially unmet" (via `perSector.health/water.unservedKwh`); warning `RESERVE_REACHED` -> "Battery reserve depleted before simulation end"; `criticalUnservedKwh == 0 && unservedKwh == 0` -> "Essential services fully supplied".
- **Chart**: `steps[t].solarKw`, `demandKw`, `servedKw`, `unservedKw`, `socPct` (kW left axis, % right axis).
- **Scene/BuildingPanel**: `perSector[id].{demandKwh, servedKwh, unservedKwh, coveragePct}`; `steps[t]` for time slice.
- **Summary strip**: `metrics.servedKwh / demandKwh`, `socEndPct`.
- **Curseur Temporel 24h**: Binds to simulation time slice step `t` (0 to 23), driving instantaneous 3D glow intensity, power line pulse speed, building status badges, and telemetry readouts.

---

## States

- **Ready**: no result yet; scene neutral, EmptyState "Your microgrid is ready to simulate." + Run first simulation button.
- **Modified**: last result dimmed + `Scenario modified` badge in Controls tab and top bar.
- **Running**: "Calculating energy distribution..." progress indicator on Run action.
- **Complete**: `Simulation complete` badge; 3D scene glow lines animate; banner and values update.
- **Error**: inline error alert in Controls tab; controls stay editable. Invalid field marked with helper message.
- **Panel Toggled Closed**: 3D Digital Twin takes 100% canvas width; floating expand handle accessible on screen edge; 24h Time Cursor remains fully interactive at bottom.
- **WebGL Unavailable**: Graceful fallback to 2D topological diagram within the large viewport.

---

## Acceptance Criteria

- [ ] 3D scene is the dominant element occupying full height and >=70% width (100% when side deck collapsed).
- [ ] Right-side panel is toggleable (can be hidden/collapsed and reopened via smooth toggle).
- [ ] Right-side panel organizes non-scene elements into four distinct tabs: `Métriques`, `Contrôles`, `Bâtiments`, and `Copilote IA`.
- [ ] Curseur Temporel 24h (24h Time Scrubber) is NOT in the tabs: it is permanently docked at the bottom of the 3D viewport, accessible at all times.
- [ ] Every slider in the Controls tab shows value, unit, min/max.
- [ ] Changing any control sets `Scenario modified` status until simulation is rerun.
- [ ] Clicking a building in the 3D twin switches the right panel to `Bâtiments` tab with engine metrics.
- [ ] Works with WebGL off (2D schematic fallback) and supports reduced motion.
- [ ] `SIMULATED DATA` label visible in sidebar/footer.
