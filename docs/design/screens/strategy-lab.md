# Strategy Lab

Route: /strategies. Goal: compare allocation strategies under identical demand, production, battery, duration. Reuse chart style and MetricCard from overview.md.

## Strategies (algorithms must exist in engine; do not describe unimplemented behavior)

- proportional: "Proportional Allocation" - shares available energy by the engine's proportional rule.
- essential_first: "Essential-First" - serves explicit priorities (critical > high > medium > low) first.
- balanced: "Balanced Allocation" - OPTIONAL/stretch; render column only if engine implements it.

## Layout

```
+--------------------------------------------------------------+
| Strategy Lab   [scenario shown, fixed inputs]  [Compare]      |
+----------------+----------------+----------------------------+
| Proportional   | Essential-First| Balanced (if available)    |
| metrics + rows | metrics + rows | metrics + rows [Use this]  |
+----------------+----------------+----------------------------+
| Grouped bars: delivered | essential coverage | unmet | SoC end |
+--------------------------------------------------------------+
| Decision summary (computed)                                   |
+--------------------------------------------------------------+
```

## Sections -> components

- Strategy columns: card with name, rule text, StatusBadge, MetricCards (compact), 5 EnergyBar rows, Button "Use this strategy".
- Comparison: ChartCard with grouped or aligned horizontal bars.
- Decision summary: InsightCard origin=computed.
- Optional AI explain: Button ghost "Explain this result" -> /copilot (violet-labeled).

## Data bindings (one result per strategy id, same scenario)

- Total delivered: result.metrics.servedKwh (kWh).
- Essential coverage: metrics.criticalCoveragePct (%); metrics.criticalUnservedKwh (kWh).
- Unmet: metrics.unservedKwh (kWh).
- Battery end: metrics.socEndPct (%), socMinPct.
- Rows: perSector[id].coveragePct, unservedKwh.
- Fairness: show only if engine exports a defined metric.
- Summary text generated only when numbers support it (e.g. essential_first criticalUnservedKwh < proportional).

## States

- No comparison run: EmptyState + "Compare strategies".
- running / error: ../states-copy.md. Scenario modified: results stale badge.
- Use this strategy: explicit click sets strategy on active scenario (status -> modified); never auto-applies.

## Acceptance

- [ ] All columns share identical inputs, shown at top.
- [ ] Every number has unit; axes labeled; consistent scales.
- [ ] Decision summary appears only when supported by results.
- [ ] Best value per metric marked by label/icon, not only color.
- [ ] "Use this strategy" requires click and confirms change.
- [ ] balanced hidden/disabled with reason if not implemented.
- [ ] Chart has text summary and empty state.
