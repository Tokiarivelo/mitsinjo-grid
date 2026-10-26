# Mitsinjo Grid design docs (index)

Product: AI-assisted rural solar microgrid simulation. Dark "Solar Observatory x Mission Control". Desktop-first (1440px).
Stack: Next.js, TS, Tailwind v4, R3F/Drei, Recharts, Zod. Source: Mitsinjo_Grid_Design_System_Stitch.md.
Load ONE file at a time; files link to each other instead of repeating.

| File                       | Load when                                                                 |
| -------------------------- | ------------------------------------------------------------------------- |
| tokens.md                  | Any styling: colors, fonts, spacing, motion, Tailwind `@theme` block      |
| shell.md                   | Building layout: sidebar, header, copilot panel, breakpoints              |
| components.md              | Building/using any shared React component                                 |
| 3d-scene.md                | Working on the R3F microgrid scene or its fallback                        |
| screens/live-simulation.md | Route /simulation                                                         |
| screens/overview.md        | Route /overview                                                           |
| screens/strategy-lab.md    | Route /strategies                                                         |
| screens/copilot.md         | Route /copilot and the side panel                                         |
| screens/scenarios.md       | Route /scenarios                                                          |
| states-copy.md             | Any empty/loading/error/modified text; a11y rules                         |
| stitch-prompts.md          | Generating screens in Google Stitch                                       |
| stitch-map.md              | Before/after any frontend work: which spec + mockup applies (design gate) |

## Generation order

1. Live Simulation 2. Overview 3. Strategy Lab 4. Copilot 5. Scenarios
   (Reason: 3D identity first, then reuse cards/charts/shell. Never generate unrelated designs.)

## Routes

/overview, /simulation, /strategies, /scenarios, /copilot

## Hard rules

1. Amber = solar only; cyan = energy flow; green = healthy outcome; violet = AI only; red = genuinely critical only.
2. Never convey status by color alone: add label, icon, or number.
3. Every screen shows a `SIMULATED DATA` marker; never imply live sensors or a real surveyed village.
4. All numbers come from the engine result; UI, 3D and AI never invent values.
5. AI text is labeled `AI EXPLANATION` (violet); computed values are labeled as computed. Never mix in one undifferentiated block.
6. No fake controls: render Pause/Step/Scrubber/fairness metric only if the engine supports it.
7. Units always: kW (power) vs kWh (energy) vs % never interchanged.
8. Show a meaningful empty/error state for every chart and panel; a failed AI call never hides computed results.
9. Respect `prefers-reduced-motion`; no decorative particles or pulsing alerts.
10. 3D is never the only way to read results: always provide a 2D summary.
