# States, Copy, Accessibility

Use with components.md (EmptyState, StatusBadge). Sim status: ready | modified | running | complete | error.

## State copy

| State                  | Title                                                   | Body                                                                                             | Action               |
| ---------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------- |
| ready / initial        | Your microgrid is ready to simulate.                    | Choose a scenario, adjust the assumptions, and run the simulation.                               | Run first simulation |
| no result (Overview)   | No simulation results yet                               | Choose a scenario and run the simulation to see energy distribution and community impact.        | Run first simulation |
| modified               | Scenario modified                                       | Run the simulation to update the results.                                                        | Run simulation       |
| running                | Calculating energy distribution...                      | (show only while engine truly processing; no fake loading)                                       | -                    |
| complete               | Simulation complete                                     | (show result summary)                                                                            | -                    |
| sim error              | Simulation could not complete.                          | Check the highlighted assumptions and try again.                                                 | Review assumptions   |
| WebGL unavailable      | 3D visualization is unavailable on this device.         | Showing the 2D infrastructure and energy summary instead.                                        | -                    |
| AI unavailable         | The AI copilot is temporarily unavailable.              | You can keep exploring the simulation and its computed results.                                  | -                    |
| AI error               | The copilot could not complete this explanation.        | Your simulation results are still available. Try again or inspect the computed metrics directly. | Try again            |
| invalid field          | `<Field>` must be between `<min>` and `<max>` `<unit>`. | (state the fix; never silently clamp)                                                            | -                    |
| chart empty            | No data to chart yet                                    | Run the simulation to see `<chart name>`.                                                        | Run simulation       |
| strategy compare empty | No comparison yet                                       | Run all strategies on the same scenario to compare them.                                         | Compare strategies   |
| scenario not run       | Not run yet                                             | -                                                                                                | Open scenario        |
| vision empty           | No appliance found on this photo.                       | Try a closer, well-lit photo.                                                                    | -                    |
| vision error           | Appliance detection failed.                             | -                                                                                                | Try again            |

## Header status labels

READY, SCENARIO MODIFIED, SIMULATING, SIMULATION COMPLETE, SIMULATION ERROR. Persistent: `SIMULATED DATA`. Provenance: `DATA SOURCE: SYNTHETIC SIMULATION`; AI label: `AI EXPLANATION`.

## Impact banners (only when true in result)

- Essential services fully supplied
- Water pumping demand partially unmet
- Clinic supply below target
- Battery reserve depleted before simulation end

## Microcopy

Do:

- Short verbs: Run simulation, Compare strategies, Inspect battery, Protect essential services, Review assumptions, Explain this result, Use this strategy, Reset scenario, Open scenario.
- Units on every number (kWh, kW, %); sentence case; mono for values.
- Say what is computed vs AI-generated.
  Don't:
- "Magic", "Optimize everything", "AI-powered insights" without concrete meaning.
- Imply live sensors, real village, or control of physical equipment.
- Claim a strategy behaves a way the engine does not implement.
- Generic AI sparkle as identity; uppercase body text; exclamation marks.

## Accessibility

- Contrast readable on dark surfaces; text-muted only for non-essential metadata.
- Visible focus ring (2px energy-cyan) on all interactive elements; full keyboard operation.
- Icon-only buttons have aria-label (e.g. "Toggle AI copilot", "Reset camera").
- Status = text + icon/number, never color alone.
- Sliders expose value, min, max, unit (aria-valuenow/min/max, aria-valuetext "40 percent").
- 3D has a 2D equivalent for every datum; no info only via animation.
- Charts: title, units, text summary (ChartCard.summary), data readable via tooltip and table/labels.
- EnergyBar uses role="progressbar" plus text percentage.
- Status changes and AI replies announced via aria-live="polite".
- Honor prefers-reduced-motion; usable at 200% browser zoom; touch targets >=40px on mobile.
- Modals trap focus, Esc closes, focus returns to trigger.
