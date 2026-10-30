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

## Header

"Mitsinjo Copilot"; subtitle "Understand the simulation. Explore the trade-offs."; `AI EXPLANATION` StatusBadge variant ai.

## Suggested prompts

- Why is the clinic receiving less energy?
- Compare the two allocation strategies.
- What happens if solar production drops by 40%?
- Which services have unmet demand?
- Explain the battery state at the end of the simulation.
- Suggest a scenario to protect essential services.
- Le soir, ne coupez pas le quartier, laissez au moins la lumière (proposes lifeline survival floor).

## Response format (ChatMessage sections)

1 What happened. 2 Computed evidence (engine values, field-referenced). 3 Why it matters (community impact). 4 Explore next (suggested change).

## Sections -> components

ChatMessage, ToolActivity ("Reading current scenario", "Running comparison", "Reviewing computed results" - only if executed), InsightCard, ConfirmProposalDialog (for proposed changes), EmptyState, Button.

## Data bindings

- Evidence rows read result.metrics.* and perSector[id].* and steps[t].* exactly; show field label + value + unit.
- Context column reads active scenario + status.
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
