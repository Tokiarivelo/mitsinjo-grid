# Phase plan (10 days, solo)

Critical path: **P3 engine → P4 2D → P6 copilot → P7 3D**. Copilot before 3D: it is the judged
Meta feature and carries external-API risk; 3D is local work and easy to time-box.

| Day | Phase                                                        | File                      | Must-have               |
| --- | ------------------------------------------------------------ | ------------------------- | ----------------------- |
| 1   | P0 Framing & access                                          | `P0-framing.md`           | ✅                      |
| 1   | P1 Repo & agent tooling                                      | `P1-repo.md`              | ✅                      |
| 2   | P2 Design system (Stitch → tokens → UI kit) — parallel to P3 | `P2-design.md`            | ✅                      |
| 2–3 | P3 Engine                                                    | `P3-engine.md`            | ✅                      |
| 4   | P4 2D dashboard + Strategy Lab                               | `P4-dashboard.md`         | ✅                      |
| 5   | P5 Controls, scenarios, timeline, export                     | `P5-controls.md`          | ✅ (timeline = stretch) |
| 6–7 | P6 Meta copilot                                              | `P6-copilot.md`           | ✅                      |
| 7–8 | P7 3D microgrid                                              | `P7-3d.md`                | ✅ simple primitives    |
| 9   | P8 Quality, perf, a11y                                       | `P8-quality.md`           | ✅                      |
| 10  | P9 Deploy, demo, submission                                  | `P9-ship.md`              | ✅                      |
| —   | PX Anomaly signal                                            | `PX-anomaly.md`           | ❌ stretch              |
| —   | PY Sector control proposals (priorities, caps)               | `PY-sector-control.md`    | ❌ stretch              |
| —   | PZ Parametrable Strategy Lab (params, rules, sweep)          | `PZ-strategy-params.md`   | phases 1–3 ✅           |
| —   | PL Lifeline power, dispatch controller, intensity lighting   | `PL-lifeline-dispatch.md` | phase 1 ✅ (engine)     |

## Cut order if late

1 PX anomaly · 1b PY sector control · 2 `balanced` strategy · 3 timeline playback · 4 export · 5 mobile polish ·
6 Malagasy · 7 3D camera presets. **Never cut:** engine invariants, 2-strategy comparison,
copilot guardrails + mock fallback, simulated-data labels, reproducible demo.

## Task file format

`ID` · checkbox · task · **Done when**. Each file lists **Read first** (the only docs to load) and
**Exit criteria**. Tick boxes as you go; record progress in `HANDOFF.md`.
