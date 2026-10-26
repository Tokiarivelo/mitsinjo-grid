# Mitsinjo Grid — Design System for Google Stitch

**Product:** Mitsinjo Grid  
**Tagline:** _See the energy. Understand the trade-offs. Protect what matters._  
**Product type:** AI-powered rural microgrid simulation and decision-support platform  
**Design direction:** Solar Observatory × Mission Control × Human-centered AI  
**Target:** Meta Global AI Developer Hackathon  
**Platform:** Responsive web application, desktop-first  
**Primary stack:** Next.js, TypeScript, Tailwind CSS, Three.js / React Three Fiber

---

## 1. Product Vision

Mitsinjo Grid is a simulation platform that helps users understand how a rural solar microgrid behaves when energy production, battery storage, or community demand changes.

The interface must make energy systems understandable at a glance. Users should be able to see the simulated microgrid, understand which services receive energy, compare allocation strategies, and ask an AI copilot to explain the results.

The product should feel like a professional energy intelligence platform—not a generic admin dashboard, not a cryptocurrency interface, and not a sci-fi game.

### Core experience

1. Observe the simulated microgrid in a live operational dashboard.
2. Explore the village and its energy infrastructure in an interactive 3D scene.
3. Change solar production, battery capacity, and community demand.
4. Compare energy allocation strategies.
5. Understand the consequences for essential services.
6. Ask the AI copilot to explain simulation results in plain language.

### Design principles

- **Clarity over decoration:** Every visual element should communicate something useful.
- **Simulation over illusion:** Visuals must reflect actual deterministic simulation outputs.
- **Energy is visible:** Use light, flow, color, and spatial relationships to explain energy distribution.
- **AI is transparent:** Clearly distinguish computed results from AI-generated explanations.
- **Human impact first:** Prioritize the clinic, water supply, school, homes, and local businesses.
- **Trust through precision:** Show units, assumptions, timestamps, and simulated-data labels.
- **Distinctive but practical:** Create a polished visual identity without sacrificing usability.

---

## 2. Art Direction

### Concept: Solar Observatory

Imagine a modern mission-control room designed to monitor a small rural solar-powered community.

The interface uses a deep midnight-blue environment, carefully layered surfaces, fine technical borders, restrained amber light, and cyan energy signals.

The 3D village is the visual centerpiece. Solar panels collect light, a central battery stores energy, and illuminated distribution lines connect the infrastructure to community buildings.

The overall result should feel calm, precise, intelligent, and quietly futuristic.

### Visual references in words

- Premium scientific instrumentation
- Satellite ground-station interfaces
- Modern energy-management software
- Architectural visualization
- Minimal editorial typography
- Cinematic lighting used with restraint
- High-end developer tools

### Avoid

- Generic purple-gradient AI dashboards
- Excessive glassmorphism
- Bright neon borders around every card
- Overloaded dashboards with dozens of charts
- Cartoon villages or toy-like 3D buildings
- Cryptocurrency-style visualizations
- Excessive animations
- Fake real-time data presented as real measurements
- Decorative graphs without meaningful units

---

## 3. Color System

Use dark mode as the primary visual identity.

### Core palette

| Token              | Hex       | Usage                            |
| ------------------ | --------- | -------------------------------- |
| `canvas`           | `#080D1A` | Main application background      |
| `canvas-raised`    | `#0D1526` | Secondary background regions     |
| `surface`          | `#111D30` | Cards, panels, sidebars          |
| `surface-elevated` | `#17253A` | Modals, dropdowns, raised cards  |
| `surface-hover`    | `#1C2D45` | Hover states                     |
| `border`           | `#26364D` | Standard separators and outlines |
| `border-strong`    | `#3B506B` | Emphasized boundaries            |
| `text-primary`     | `#F4F7FB` | Main headings and values         |
| `text-secondary`   | `#A8B6C9` | Supporting text                  |
| `text-muted`       | `#72839A` | Metadata and inactive labels     |

### Energy colors

| Token           | Hex       | Meaning                                       |
| --------------- | --------- | --------------------------------------------- |
| `solar-amber`   | `#FFB547` | Solar production and sunlight                 |
| `energy-cyan`   | `#50D8E8` | Energy flow and electrical connections        |
| `network-blue`  | `#729CFF` | Distribution network and secondary series     |
| `battery-green` | `#53D6A0` | Healthy battery state and successful outcomes |
| `ai-violet`     | `#B6A0FF` | AI copilot and AI-generated insights          |
| `warning-amber` | `#FFCB70` | Energy shortage warnings                      |
| `critical-red`  | `#FF7185` | Critical failures and unmet essential demand  |

### Color usage rules

1. Amber represents solar generation, not general decoration.
2. Cyan represents energy flow or electrical connections.
3. Green represents healthy or favorable outcomes, not every positive-looking element.
4. Violet is reserved for AI-specific elements.
5. Red is reserved for genuinely critical conditions.
6. Never communicate status through color alone; always add a label, icon, or numeric value.
7. Keep most of the interface neutral. Energy colors should guide attention.

### Background treatment

Use subtle radial illumination behind the 3D scene and the main dashboard hero.

Example:

- Base background: `#080D1A`
- Soft amber glow behind solar panels
- Very subtle cyan glow near the battery and network
- No full-screen rainbow gradients

---

## 4. Typography

Use three complementary typefaces.

### Display and headings: Space Grotesk

Use for page titles, section headings, and prominent metrics.

Characteristics: modern, geometric, technical, distinctive.

### Body and interface: Inter

Use for descriptions, buttons, navigation, tooltips, and form labels.

Characteristics: highly readable and neutral.

### Technical data: IBM Plex Mono

Use for energy readings, simulation timestamps, IDs, percentages, and technical metadata.

Examples:

- `12.8 kWh`
- `84%`
- `SIM-0042`
- `14:32:08`
- `−40% SOLAR GENERATION`

### Typography scale

| Role             |     Size | Weight |
| ---------------- | -------: | -----: |
| Main page title  | 30–36 px |    600 |
| Hero metric      | 32–44 px |    600 |
| Section heading  | 18–22 px |    600 |
| Card heading     | 14–16 px |    600 |
| Body             |    14 px |    400 |
| Supporting text  | 12–13 px |    400 |
| Technical labels | 11–12 px |    500 |
| Compact data     | 13–15 px |    500 |

Use sentence case rather than excessive uppercase text. Reserve uppercase for small technical labels.

---

## 5. Layout and Grid

### Desktop structure

Design around a 1440 px desktop viewport, while supporting smaller laptops and mobile devices.

The main application has three primary zones:

1. Left navigation sidebar.
2. Central workspace.
3. Optional right-side AI copilot panel.

### Recommended dimensions

- Left sidebar: 232 px.
- Top header: 68 px.
- AI copilot panel: 360 px, adjustable between approximately 340 and 380 px.
- Main content padding: 24 px.
- Card internal padding: 18–24 px.
- Standard card radius: 16 px.
- Small control radius: 8–10 px.
- Large modal radius: 20 px.

### Spacing scale

Use a consistent 4 px base scale.

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64`

Avoid arbitrary spacing values when an existing token works.

### Layout behavior

- The sidebar remains stable on desktop.
- The copilot can collapse to give the simulation more room.
- The main content scrolls independently when appropriate.
- Charts and cards must resize without clipping.
- On tablets, use collapsible navigation and a drawer for the copilot.
- On mobile, prioritize scenario controls, key metrics, and a simplified 3D view.
- Never shrink the desktop dashboard into an unreadable miniature.

---

## 6. Navigation

Use a compact, icon-led sidebar with clear text labels.

### Brand area

- Small geometric sun/network symbol.
- Product name: **Mitsinjo Grid**.
- Small environment label: `SIMULATION LAB`.

### Navigation items

1. **Overview** — operational summary.
2. **Live Simulation** — interactive 3D microgrid.
3. **Strategy Lab** — compare allocation policies.
4. **Scenarios** — saved and predefined simulation scenarios.
5. **AI Copilot** — AI explanations and analysis.

### Sidebar footer

- Current simulation status.
- `SIMULATED DATA` badge.
- Settings and documentation links.

### Active navigation state

Use a slightly brighter surface, a thin cyan accent at the left edge, and high-contrast text.

Do not use oversized icons or heavily rounded navigation pills.

---

## 7. Global Application Header

The header should feel like an instrument panel rather than a generic website navbar.

### Left side

- Current page title.
- Breadcrumb when useful.
- Small context subtitle.

### Right side

- Scenario selector.
- Simulation status.
- Reset button.
- AI copilot toggle.
- User/profile placeholder only if authentication is implemented.

### Status examples

- `READY`
- `SIMULATING`
- `SIMULATION COMPLETE`
- `SCENARIO MODIFIED`

Always distinguish simulation status from the real-world operating status of an actual microgrid.

Use the label `SIMULATION` or `SIMULATED` prominently enough that nobody mistakes generated data for live field measurements.

---

## 8. Signature Component: Interactive 3D Microgrid

The 3D microgrid is the defining feature of Mitsinjo Grid.

It should occupy a substantial portion of the Live Simulation screen and communicate the system's structure immediately.

### Visual composition

Create a stylized rural village in Madagascar-inspired surroundings:

- Solar panel array
- Central battery storage unit
- Distribution poles and power lines
- Community clinic
- Water pumping station
- School
- Residential houses
- Small market or artisan workshop
- Simple terrain, paths, trees, and a subtle horizon

The visual should be inspired by rural Madagascar without implying that the simulated village is a surveyed real location.

### 3D style

- Clean architectural visualization.
- Semi-realistic low-poly geometry with refined materials.
- Deep blue twilight environment.
- Warm sunlight and amber highlights.
- Soft contact shadows.
- Restrained atmospheric depth.
- Clearly recognizable infrastructure.
- Legible silhouettes at normal dashboard scale.

Avoid toy-like proportions, excessive vegetation, and cinematic effects that obscure the infrastructure.

### Camera

- Three-quarter isometric perspective by default.
- Smooth orbit controls.
- Limited zoom range to preserve orientation.
- A visible reset-camera action.
- Optional preset views: `Village`, `Solar Array`, `Battery`, `Essential Services`.

### Energy visualization

The energy network must reflect the deterministic simulation engine.

- Solar array glow reflects simulated production.
- Battery fill and color reflect simulated state of charge.
- Distribution lines illuminate when the corresponding simulated energy flow is active.
- Buildings receive a status indicator based on their computed supply.
- Unmet demand appears as a restrained warning signal.
- Essential services remain visually identifiable without opening a detail panel.

Do not invent electrical flow values inside the rendering layer.

### Building interaction

Clicking a building opens a compact detail panel containing:

- Building name and category.
- Simulated demand in kWh.
- Allocated energy in kWh.
- Percentage of demand supplied.
- Priority level.
- Unmet demand, if any.
- Status label.
- A short explanation of the result.

Example:

**Community Clinic**

- Demand: `8.0 kWh`
- Allocated: `7.2 kWh`
- Demand supplied: `90%`
- Unmet demand: `0.8 kWh`
- Priority: `Critical`

These values are illustrative examples only. All displayed numbers must come from the active simulation state.

### Performance

- Prefer instanced geometry for repeated objects.
- Limit unnecessary dynamic shadows.
- Avoid excessive particle systems.
- Use simple geometry for secondary buildings.
- Provide a simplified view if WebGL is unavailable.
- Keep controls usable on integrated graphics hardware.
- Respect reduced-motion preferences.

---

## 9. Screen One: Overview Dashboard

### Goal

Answer three questions within five seconds:

1. How much energy is available?
2. Are essential services receiving sufficient energy?
3. What happens if the current scenario changes?

### Hero section

Title: **Microgrid Overview**

Subtitle: `Understand energy availability and community impact.`

Include a clear scenario label and a `Run simulation` or `Open live simulation` action.

### Primary metric cards

Create four compact metric cards:

**Solar Generation**

- Current simulated output in kW.
- Trend or change relative to baseline.
- Small amber generation icon.

**Battery State**

- State of charge in percent.
- Stored energy in kWh.
- A compact battery indicator.

**Community Demand**

- Total demand in kW or kWh, depending on the defined time basis.
- Demand served.
- Keep power and energy units distinct.

**Essential Services**

- Percentage of essential demand served.
- Number of affected services.
- Clear warning when a critical threshold is crossed.

All values must be calculated by the simulation engine.

### Main content grid

Top region:

- Large 3D microgrid preview.
- Compact energy balance summary.

Lower region:

- Energy generation versus demand chart.
- Service allocation overview.
- Scenario impact panel.

### Energy balance

Visualize the relationship between:

- Solar generation.
- Battery discharge or charge.
- Total served demand.
- Unmet demand.

Clearly define the energy accounting rules used by the engine. Do not imply that every quantity is interchangeable between kW and kWh.

### Service allocation

Use one compact row per service:

- Clinic
- Water
- School
- Households
- Market

Each row includes a small icon, supplied-demand percentage, progress bar, and status label.

### Empty and error states

If the simulation has not run, show a meaningful prompt:

`No simulation results yet`

`Choose a scenario and run the simulation to see energy distribution and community impact.`

Include a primary action to run the first simulation.

---

## 10. Screen Two: Live Simulation

### Goal

Let users explore the microgrid and observe how scenario changes affect energy distribution.

### Layout

- Large interactive 3D scene.
- Compact simulation controls.
- Energy balance panel.
- Selected building details.
- Optional timeline or playback controls.

### Control panel

Include:

- Solar generation multiplier or percentage.
- Battery capacity.
- Initial battery state of charge.
- Demand adjustment.
- Simulation duration.
- Scenario selection.
- Allocation strategy.
- `Run simulation`.
- `Reset scenario`.

Use sliders for continuous numeric parameters and dropdowns for discrete choices.

Show the current value beside every slider. Include min/max bounds and units.

### Simulation controls

Support:

- Run.
- Pause, only if the simulation actually supports pausing.
- Reset.
- Step forward, if discrete time stepping is implemented.
- Timeline scrubber, if time-series simulation is implemented.

Do not show inactive controls that imply nonexistent functionality.

### Simulation feedback

When parameters change, show a `Scenario modified` indicator until the simulation is rerun.

After the run, show a clear transition to `Simulation complete`.

If the simulation is computationally immediate, use subtle feedback rather than a fake loading sequence.

### Impact banner

Examples:

- `Essential services fully supplied`
- `Water pumping demand partially unmet`
- `Clinic supply below target`
- `Battery reserve depleted before simulation end`

Only display a banner when the corresponding condition is true in computed results.

---

## 11. Screen Three: Strategy Lab

### Goal

Make trade-offs between energy allocation strategies understandable.

### Main concept

Compare strategies using the same demand, production, battery assumptions, and simulation duration.

Suggested strategies:

1. **Proportional Allocation** — distribute available energy according to the defined proportional allocation rule.
2. **Essential-First** — allocate according to explicit priorities for essential services before lower-priority demand.
3. **Balanced Allocation** — use a documented compromise between service coverage and fairness.

The exact algorithm for each strategy must be defined and implemented in the simulation engine. Never imply that a strategy behaves in a specific way unless the code implements that behavior.

### Layout

Show strategies as comparable columns or cards.

Each strategy includes:

- Strategy name.
- Short rule description.
- Total demand served.
- Essential demand served.
- Unmet demand.
- Battery remaining at the end.
- Service-level results.
- Fairness metric, only if a meaningful metric is implemented.

### Comparison visualization

Use grouped bar charts or aligned horizontal bars.

Suggested comparison categories:

- Total energy delivered.
- Essential demand coverage.
- Unmet energy.
- End-of-simulation battery state.

Keep units consistent and label all axes.

### Decision summary

Provide a concise result statement:

`Essential-First protects critical services more effectively in this scenario, while reducing energy available to lower-priority consumers.`

Only generate this statement when the calculated results support it.

### Strategy selection

Include a `Use this strategy` action that applies the selected strategy to the active scenario.

Do not automatically overwrite scenario settings without a clear user action.

---

## 12. Screen Four: AI Copilot

### Goal

Make simulation results easier to understand without allowing the language model to replace the simulation engine.

### Visual design

The copilot is a calm, professional assistant panel.

- Violet accent reserved for AI identity.
- Dark surface with subtle separation from the main workspace.
- Clear distinction between user messages, AI explanations, and computed data.
- Compact source/result references.
- Prompt suggestions to help first-time users.

### Header

**Mitsinjo Copilot**

Subtitle: `Understand the simulation. Explore the trade-offs.`

Show a small label: `AI EXPLANATION`

### Suggested prompts

- `Why is the clinic receiving less energy?`
- `Compare the two allocation strategies.`
- `What happens if solar production drops by 40%?`
- `Which services have unmet demand?`
- `Explain the battery state at the end of the simulation.`
- `Suggest a scenario to protect essential services.`

### Response format

AI responses should be structured:

1. **What happened** — concise explanation.
2. **Computed evidence** — values retrieved from simulation results.
3. **Why it matters** — community impact.
4. **What to explore next** — a suggested simulation change.

Example structure:

**What happened**

Solar production dropped in the selected scenario.

**Computed evidence**

The simulation reports lower available energy and identifies which services have unmet demand.

**Why it matters**

The allocation strategy determines how the shortage is distributed among community services.

**Explore next**

Compare the current strategy with Essential-First under the same assumptions.

The actual response must reference real result fields and must not fabricate figures.

### Tool transparency

When the copilot calls a simulation tool, show a small activity indicator:

- `Reading current scenario`
- `Running comparison`
- `Reviewing computed results`

Only show activity for tools that actually execute.

### AI safety and reliability

- The deterministic engine calculates all numeric results.
- The AI may explain results and propose scenario changes.
- Any proposed change must be validated against the scenario schema.
- The user must explicitly approve changes before they are applied.
- The AI must never claim to control physical equipment.
- Clearly label AI-generated interpretations.
- If simulation data is missing, say so rather than guessing.
- Treat Meta Model API availability as an implementation dependency, not a visual guarantee.

### Error state

`The copilot could not complete this explanation.`

`Your simulation results are still available. Try again or inspect the computed metrics directly.`

Never hide or replace deterministic results because an AI request failed.

---

## 13. Screen Five: Scenarios and Assumptions

### Goal

Make simulation assumptions understandable, repeatable, and easy to compare.

### Scenario cards

Each card contains:

- Scenario name.
- One-sentence description.
- Scenario type.
- Key parameter changes.
- Last run status.
- `Open scenario` action.

Suggested predefined scenarios:

**Baseline Village**
Normal simulated production and demand.

**Cloudy Afternoon**
Reduced solar generation over a defined period.

**High Community Demand**
Higher demand from households and community services.

**Battery Constraint**
Reduced storage capacity or lower initial state of charge.

**Essential Services Under Stress**
A scenario designed to test service prioritization during a shortage.

These are synthetic scenarios, not historical observations.

### Assumptions panel

Show:

- Solar generation profile.
- Battery capacity and efficiency assumptions.
- Initial battery state of charge.
- Demand profiles by service.
- Simulation duration and time step.
- Allocation rules.
- Any modeled system losses.

Every assumption should be editable only when supported by the application.

### Provenance

Display:

`DATA SOURCE: SYNTHETIC SIMULATION`

Add a short note explaining that the data is illustrative and is not measured from a real village.

### Reproducibility

Provide an option to reset a scenario to its defaults and show a compact summary of the parameters used for the latest run.

---

## 14. Data Visualization

Charts should explain the system, not simply fill empty space.

### Chart styling

- Transparent or matching surface backgrounds.
- Minimal gridlines.
- Muted axis labels.
- Clear units.
- Restrained use of energy colors.
- Tooltips with exact values and definitions.
- No 3D pie charts.
- No excessive gradients or decorative chart backgrounds.

### Recommended charts

**Energy Over Time**
Line chart showing solar generation, demand, battery contribution, or state of charge over time. Use separate axes if necessary and label them clearly.

**Service Coverage**
Horizontal bars showing supplied demand as a percentage for each service.

**Strategy Comparison**
Grouped bars comparing service coverage or unmet demand across allocation strategies.

**Energy Balance**
A carefully defined balance visualization showing input, storage changes, served demand, and losses where modeled.

### Rules

- Do not mix kW and kWh without clearly distinguishing them.
- Do not invent historical trends from a single simulation result.
- Do not show confidence intervals unless uncertainty is modeled.
- Do not use a gauge when a simple number or bar is clearer.
- Every chart must have a meaningful empty state.
- All chart data must come from the simulation engine.

---

## 15. Component Library

Create reusable, consistently styled components.

### Metric Card

Contains:

- Compact label.
- Main value.
- Unit.
- Optional change indicator.
- Small explanatory label.
- Optional icon.

Variants:

- Solar
- Battery
- Demand
- Essential services

### Status Badge

Variants:

- Ready
- Running
- Complete
- Warning
- Critical
- Simulated
- AI-generated

Use restrained fills and readable text.

### Energy Progress Bar

Contains:

- Service name.
- Supplied-demand percentage.
- Current and target values when applicable.
- Accessible text label.

### Scenario Selector

Includes:

- Scenario name.
- Short description.
- Modified-state indicator.
- Keyboard-accessible dropdown.

### Simulation Control

Includes:

- Label.
- Numeric value.
- Unit.
- Slider or input.
- Min/max description.
- Validation feedback.

### Insight Card

Contains:

- Short title.
- Insight text.
- Evidence reference.
- Optional action to open a relevant simulation view.

### AI Message

Distinguish:

- User message.
- AI explanation.
- Computed evidence.
- Tool activity.
- Error or retry state.

### Building Detail Panel

Contains:

- Building name and icon.
- Service category.
- Demand and allocated energy.
- Supply coverage.
- Unmet demand.
- Priority.
- Status.

### Modal and Drawer

Use for:

- Scenario configuration.
- Assumption editing.
- Confirmation of proposed AI changes.
- Building details on small screens.

### Button variants

**Primary:** high-contrast amber or another clearly defined primary treatment.

**Secondary:** neutral surface with a subtle border.

**Ghost:** minimal treatment for secondary actions.

**Danger:** reserved for destructive actions.

Include hover, active, disabled, focus-visible, and loading states.

---

## 16. Interaction and Motion

Motion should communicate a meaningful change in system state.

### Recommended motion

- Short transitions between surface states.
- Smooth but restrained camera movement.
- Gentle energy-flow animation while a simulated flow is active.
- Battery fill updates after a completed simulation.
- Subtle chart transitions when the underlying data changes.
- Clear visual feedback after changing scenario parameters.

### Timing

- Small interface transitions: approximately 120–180 ms.
- Panel transitions: approximately 180–260 ms.
- Camera transitions: short and interruptible.

These are design targets, not mandatory implementation timings.

### Avoid

- Continuous decorative particles.
- Shaking cards.
- Aggressive pulsing alerts.
- Long loading animations for instant calculations.
- Animations that prevent users from reading values.
- Automatically moving the camera while a user is exploring the scene.

Respect `prefers-reduced-motion`.

---

## 17. Accessibility

- Maintain readable contrast against dark surfaces.
- Use visible keyboard focus indicators.
- Support keyboard navigation for all controls.
- Provide accessible names for icon-only buttons.
- Use text labels in addition to status colors.
- Keep text legible at browser zoom.
- Ensure sliders expose values and bounds.
- Provide a 2D summary of information represented in the 3D scene.
- Avoid conveying critical information only through animation.
- Ensure chart data can be understood through labels and summaries.

The 3D visualization must enhance accessibility, not become the only way to understand the results.

---

## 18. Responsive Design

### Desktop: 1280 px and above

- Full navigation sidebar.
- Large 3D viewport.
- Metric cards in a row.
- Optional persistent copilot panel.

### Tablet: 768–1279 px

- Collapsible sidebar.
- Reduced metric-card columns.
- Copilot in a drawer.
- Simplified 3D controls.

### Mobile: below 768 px

- Compact top bar.
- Navigation drawer.
- Stacked metric cards.
- Scenario controls grouped into expandable sections.
- Simplified 3D viewport with touch-friendly controls.
- Essential information available in a 2D list.
- Copilot displayed as a full-height drawer or dedicated view.

Do not attempt to fit the entire desktop dashboard into one mobile screen.

---

## 19. Loading, Empty, and Error States

Design these states intentionally.

### Initial state

`Your microgrid is ready to simulate.`

`Choose a scenario, adjust the assumptions, and run the simulation.`

Primary action: `Run first simulation`

### Modified scenario

`Scenario modified`

`Run the simulation to update the results.`

### Simulation running

`Calculating energy distribution…`

Only show this while the engine is actually processing.

### Simulation complete

`Simulation complete`

Display the computed result summary.

### WebGL unavailable

`3D visualization is unavailable on this device.`

Provide a functional 2D infrastructure and energy summary.

### AI unavailable

`The AI copilot is temporarily unavailable.`

Allow users to continue exploring the simulation and its computed results.

### Invalid assumptions

Explain which field is invalid and how to correct it. Do not silently clamp values without communicating the change.

---

## 20. Technical Design Constraints

The visual system must align with the implementation architecture.

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- Reusable React components
- React Three Fiber and Drei for 3D
- Recharts for charts
- Zod for scenario and tool-input validation
- Vitest for simulation and utility tests
- Playwright for end-to-end tests

### Simulation engine

Implement a deterministic TypeScript engine as the source of truth for:

- Energy production.
- Demand.
- Battery state.
- Energy allocation.
- Service coverage.
- Unmet demand.
- Strategy comparison.
- Time-series results, if supported.

The 3D scene, charts, metric cards, and AI explanations must consume the same computed simulation result.

### AI integration

The Meta Model API may provide:

- Natural-language explanations.
- Scenario recommendations.
- Structured requests to compare scenarios.
- Tool calls to supported simulation functions.

AI responses must not directly invent simulation values. Validate structured tool inputs and obtain numeric evidence from the deterministic engine.

### Data

- Use synthetic scenario data for the MVP.
- Clearly label synthetic data.
- Do not imply that a live sensor, real village, or actual energy infrastructure is connected.
- A database is optional and not required for the initial MVP.

### Performance

- Lazy-load the 3D scene where appropriate.
- Avoid unnecessary rerenders of the scene.
- Keep simulation calculations independent of rendering.
- Avoid heavy assets that do not improve understanding.
- Provide a meaningful fallback for unsupported graphics hardware.

---

## 21. Brand Identity

### Brand personality

- Intelligent
- Grounded
- Optimistic
- Precise
- Community-oriented
- Technically credible

### Logo direction

Create a minimal geometric symbol combining:

- A rising sun.
- A central energy node.
- A small network of connected points.

The symbol should remain recognizable at 24 × 24 px.

Use a simple vector-style mark, not a detailed illustration.

### Wordmark

`Mitsinjo Grid`

Use Space Grotesk with medium weight and balanced spacing.

The brand should not rely on generic AI sparkle symbols as its primary identity.

### Microcopy style

Use concise, human language.

Good examples:

- `Run simulation`
- `Compare strategies`
- `Inspect battery`
- `Protect essential services`
- `Review assumptions`
- `Explain this result`

Avoid vague labels such as `Magic`, `Optimize everything`, or `AI-powered insights` without a concrete explanation.

---

## 22. Google Stitch Generation Instructions

Use the following instructions when generating the UI.

**Create a premium, dark-mode web application called Mitsinjo Grid, an AI-assisted rural solar microgrid simulation platform. The visual identity is Solar Observatory × Mission Control: deep midnight-blue surfaces, refined technical borders, warm solar amber, energy cyan, restrained AI violet, crisp typography, and a strong sense of spatial depth.**

The primary experience is an interactive 3D rural microgrid inspired by Madagascar. It includes solar panels, battery storage, electrical distribution lines, a clinic, a water pump, a school, houses, and a small market. The 3D scene must be the signature visual element, not a tiny decorative preview.

Create a professional application shell with a 232 px left sidebar, a compact top header, a central workspace, and an optional right-side AI copilot panel.

Generate these screens:

1. Overview Dashboard.
2. Live Simulation.
3. Strategy Lab.
4. AI Copilot.
5. Scenarios and Assumptions.

Use reusable cards, consistent spacing, accessible controls, compact metric cards, restrained charts, clear status badges, and detailed empty/error states.

The dashboard must look polished enough for a high-quality international AI hackathon demonstration while remaining realistic to implement with Next.js, TypeScript, Tailwind CSS, React Three Fiber, Drei, and Recharts.

Do not use a generic SaaS template. Do not overuse gradients, glassmorphism, neon, or decorative AI imagery. Do not make the 3D village look like a cartoon game. Make the interface precise, memorable, functional, and human-centered.

**Important:** All numerical data is synthetic simulation data. Show clear labels identifying simulated results. The design must distinguish computed energy metrics from AI-generated explanations.

---

## 23. Recommended Screen Generation Order

Generate screens in this order so the visual language remains consistent:

1. **Live Simulation** — establish the signature 3D experience and design identity.
2. **Overview Dashboard** — reuse the established metrics, cards, and status components.
3. **Strategy Lab** — reuse the same energy metrics and chart styling.
4. **AI Copilot** — reuse the application shell and introduce AI-specific styling.
5. **Scenarios and Assumptions** — reuse the established form and scenario components.

Ask Stitch to preserve the same color tokens, typography, spacing, navigation, and component styles across all screens.

Do not generate five unrelated designs.

---

## 24. Definition of Success

The design is successful when:

- A first-time visitor understands the product within five seconds.
- The 3D microgrid is visually distinctive and immediately understandable.
- Energy production, battery state, and service coverage are easy to inspect.
- The impact of a production shortage is easy to explain.
- Allocation strategies can be compared without confusion.
- AI explanations are clearly separated from computed facts.
- Every numerical result has a clear unit and simulation context.
- The interface remains usable without 3D rendering or AI access.
- The design is achievable within a solo-developer hackathon project.
- The application looks like a credible energy decision-support tool, not merely a beautiful concept mockup.

**Final design principle:** Make the invisible flow of energy visible, and make the consequences for people understandable.
