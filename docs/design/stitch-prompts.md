# Google Stitch prompts

Generate in order; paste PREAMBLE then the screen prompt. After each screen, run the consistency follow-up. Details: tokens.md, shell.md, components.md.

## Preamble

Mitsinjo Grid: premium dark-mode web app, AI-assisted rural solar microgrid simulation. Style: Solar Observatory x Mission Control, calm, precise, not generic SaaS. Palette: canvas #080D1A, surface #111D30, elevated #17253A, border #26364D, text #F4F7FB / #A8B6C9 / #72839A; solar amber #FFB547, energy cyan #50D8E8, network blue #729CFF, battery green #53D6A0, AI violet #B6A0FF (AI only), warning #FFCB70, critical red #FF7185. Fonts: Space Grotesk headings, Inter body, IBM Plex Mono for numbers. Shell: 232px left sidebar (Overview, Live Simulation, Strategy Lab, Scenarios, AI Copilot; cyan active edge; SIMULATED DATA badge in footer), 68px header (scenario selector, status badge, Reset, copilot toggle), 16px card radius. All data is synthetic; show units.

## 1. Live Simulation

Screen "Live Simulation". Large interactive 3D low-poly Madagascar-inspired village at twilight (solar array, central battery, power lines, clinic, water pump, school, houses, market) filling most of the workspace, with camera presets (Village, Solar Array, Battery, Essential Services) and reset-camera. Right control panel: sliders with value, unit and min/max for solar generation %, battery capacity kWh, initial battery %, demand %, duration h; scenario and strategy dropdowns; Run simulation (amber primary) and Reset scenario. Below: kW energy-over-time chart and a clinic detail panel (demand, allocated, % supplied, unmet kWh, priority Critical). Conditional impact banner and "Scenario modified" badge. No pause or scrubber.

## 2. Overview

Screen "Microgrid Overview", subtitle "Understand energy availability and community impact." Four compact metric cards: Solar Generation kW, Battery State % and kWh, Community Demand kWh served, Essential Services % served with warning. Below: large 3D village preview with energy balance summary; chart of generation vs demand; service allocation rows for Clinic, Water, School, Households, Market with icon, % bar, status label; scenario impact panel. Primary button "Open live simulation". Reuse Live Simulation components exactly.

## 3. Strategy Lab

Screen "Strategy Lab". Three comparable strategy columns (Proportional Allocation, Essential-First, Balanced Allocation) on identical inputs. Each: rule description, total served kWh, essential coverage %, unmet kWh, battery end %, five service bars, "Use this strategy" button. Beneath: grouped bar chart with labeled axes and units. Decision summary card in neutral style. Reuse Overview metric cards and chart styling.

## 4. AI Copilot

Screen "AI Copilot". Chat view titled "Mitsinjo Copilot", subtitle "Understand the simulation. Explore the trade-offs.", label AI EXPLANATION in violet. Messages: user bubble; AI answer with sections What happened, Computed evidence (neutral mono value rows), Why it matters, Explore next; tool activity line "Reviewing computed results". Suggested prompt chips, input bar, and a proposal confirmation dialog showing a parameter diff with Approve and Reject. Violet only on AI elements. Reuse shell.

## 5. Scenarios

Screen "Scenarios and Assumptions". Grid of scenario cards (Baseline Village, Cloudy Afternoon, High Community Demand, Battery Constraint, Essential Services Under Stress) with description, key changes, last-run status, Open scenario. Side assumptions panel: solar profile, battery capacity and efficiency, initial charge, demand per service, 24 h at 1 h steps, allocation rules, Reset to defaults. Banner "DATA SOURCE: SYNTHETIC SIMULATION" with note. Reuse form controls and cards.

## Consistency follow-up (after each screen)

Keep exactly the same color tokens, fonts, spacing scale (4px base), 232px sidebar, 68px header, 16px card radius, status badges, buttons and card styles as the previous screens. Violet only for AI. No new gradients, neon, or glassmorphism. Show units on every number and a SIMULATED DATA label. Fix any deviation from the earlier screens without redesigning layout.
