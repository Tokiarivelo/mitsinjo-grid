# AI Copilot

Route: /copilot (full view); same component is the CopilotPanel (360px) elsewhere. Goal: explain results; engine stays the source of truth. Violet = AI only (../tokens.md).

## Layout

```
+----------------------------------+---------------------------+
| Mitsinjo Copilot  [AI EXPLANATION]| Context (computed)        |
| subtitle                         | scenario, strategy, status|
+----------------------------------+ key metrics (neutral)     |
| ChatMessage list                 | SIMULATED DATA            |
|  user / assistant / ToolActivity |                           |
|  evidence blocks                 |                           |
+----------------------------------+                           |
| suggested prompts chips          |                           |
| [ input ................ ][Send] |                           |
+----------------------------------+---------------------------+
```

In panel mode: single column, no context column.

Scroll: the message list is its own scroller (`role="log"`, max 65dvh, follows new text while at the bottom). On wide
screens (`xl`) `/copilot` fills the main area: the list takes the free height, input stays docked at the bottom, the
context column scrolls on its own. Below `md` the list lets the swipe pass on to the page at its ends.

## Header

"Mitsinjo Copilot"; subtitle "Understand the simulation. Explore the trade-offs."; `AI EXPLANATION` StatusBadge variant ai.

## Suggested prompts

Generated from the simulation the operator ran (`suggestPrompts({ result, input, fires })`), never a fixed list.
No result yet (and no fire) → `RunSimulationCta` instead of chips: dashed ai-violet card « Run a simulation first » +
short why, primary « Run simulation » (store `run()`) and secondary link « Choose a scenario » (`/scenarios`), both
≥ 44 px, stacked on mobile. The compact follow-up row shows nothing until a run.

With a result, in order (≤ 6): live fires (below) · scripted fires of the scenario not burning yet (« Fire planned –
{sector} at {hour}:00 », incident tone) · critical deficit (switch to essential-first, why {sector}) · deficit hours ·
one chip per scenario event with its own numbers (solar drop {pct}% {from}–{to}, demand spike) · compare strategies ·
unmet demand · deep battery. A calm run (< 4 chips) adds what-ifs on its numbers: battery ends at {pct}% · {kwh} kWh
curtailed · solar drops 40% · protect essential services.

Fire burning at the shown hour (M2, `suggestPrompts({ fires })`, sectors from `useActiveFires`): header « About the fire »
(flame, critical-red) and four chips first, flame icon + red border: « Fire at {sector}: what does it change for the village
right now? » · « …are the clinic and the water pump still supplied? » · « …where does its energy go while it is isolated? » ·
« …once it is out, how do we safely bring its power back? »; one impact chip per other burning sector, then the result-driven list.
Same in the follow-up row. The fire banner's « Ask the copilot » opens `/copilot` on these. Worded without "cut" (the
offline copilot would read a new cut order; eval test).

## Response format (ChatMessage sections)

1 What happened. 2 Computed evidence (engine values, field-referenced). 3 Why it matters (community impact). 4 Explore next (suggested change).

## Sections -> components

ChatMessage, ToolActivity ("Reading current scenario", "Running comparison", "Reviewing computed results" - only if executed), InsightCard, ConfirmProposalDialog (for proposed changes), EmptyState, Button.

## Data bindings

- Evidence rows read result.metrics.* and perSector[id].* and steps[t].* exactly; show field label + value + unit.
- Context column reads active scenario + status.
- Voice spectrum (`VoiceSpectrum`, above the input while the mic records): Web Audio `AnalyserNode` (FFT 4096), 48 bars on a
  log axis 80 Hz–8 kHz, each bar = loudest FFT bin whose centre is in its band; cyan line + "Peak" readout = loudest
  frequency; shaded "Voice pitch" zone 85–255 Hz. Audio measurement only (no energy number); hidden without Web Audio.
- Proposed change: Zod-validated scenario patch (including lifeline floors, sector caps, priorities, and strategy switch) -> ConfirmProposalDialog -> shows before/after diff -> applies only on Approve (status -> modified).

## Rules

- AI never computes numbers; missing data -> say so.
- Never claims to control physical equipment.
- Evidence blocks neutral/computed, AI prose violet-labeled.

## States

- empty (prompt chips), pending (ToolActivity + typing), error (copy in ../states-copy.md; results remain), AI unavailable (input disabled, simulation links remain), no result (explain prompt to run first).

## Acceptance

- [ ] Violet appears only on AI elements.
- [ ] Each assistant answer has the four sections.
- [ ] Evidence values match engine result fields.
- [ ] ToolActivity only for executed tools.
- [ ] Proposed changes need explicit approval and show a diff.
- [ ] AI failure never hides computed metrics.
- [ ] Input and chips keyboard accessible; messages in aria-live region.
