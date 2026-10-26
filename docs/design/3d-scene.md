# 3D Microgrid Scene

Signature element. React Three Fiber + Drei, lazy-loaded. Shown full on /simulation, preview on /overview. Tokens: tokens.md.
Reference visuals: `design/reference/tableau-de-bord-solaire-futuriste.png` (3D scene in context) and `design/reference/village-3d-2d-schema.jpg` (canonical 3D & 2D village topology).

## Composition

- Solar array, central battery unit, distribution poles + lines, clinic, water pumping station, school, houses, market/workshop, simple terrain, paths, few trees, subtle horizon.
- Canonical layout (see `design/reference/village-viewport-reference.png`):
  - Solar Array: top-left (tilted blue panels + inverter box)
  - Central Battery BESS: center (storage container unit + glowing charge LED)
  - Water Pump Station: mid-left (water tank tower on steel frame)
  - Primary School: top-center (pitched roof building + rooftop solar panels)
  - Rural Health Clinic: center-right (clinic pavilion with red cross emblem)
  - Village Houses: bottom-left (traditional houses and thatched huts)
  - Communal Market: bottom-center (open stalls with striped awnings)
- Madagascar-inspired, NOT a surveyed real location (label as simulated).
- Sector mapping: health=Clinic, water=Water pump, school=School, households=Houses, market=Market.

## Style

- Clean architectural viz; semi-realistic low-poly with refined materials; deep blue twilight; warm sun and amber highlights; soft contact shadows; restrained depth.
- Legible silhouettes at dashboard scale; essential services identifiable without opening a panel.
- Avoid: toy/cartoon proportions, excess vegetation, cinematic effects hiding infrastructure.

## Camera

- Default three-quarter isometric perspective; smooth orbit; limited zoom range; reset-camera button (aria-label "Reset camera").
- Presets: `Village` (default), `Solar Array`, `Battery`, `Essential Services`. Transitions short and interruptible; never auto-move while user is exploring.

## Energy visual mapping (render only; never compute flows here)

| Visual                                                                                                                                      | Driven by                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Solar array glow intensity                                                                                                                  | result.steps[t].solarKw / peak solarKw                                                       |
| Battery fill + color                                                                                                                        | result.steps[t].socPct (green healthy; warning-amber low; critical-red depleted, with label) |
| Battery link line active                                                                                                                    | result.steps[t].batteryKw != 0 (direction from sign; > 0 charging, < 0 discharging)          |
| Solar-to-network line lit                                                                                                                   | result.steps[t].solarKw > 0                                                                  |
| Network-to-building line lit                                                                                                                | metrics.perSector[id].servedKwh > 0 (per step if available)                                  |
| Building status indicator                                                                                                                   | metrics.perSector[id].coveragePct (full / partial / critical)                                |
| Unmet demand warning (restrained)                                                                                                           | metrics.perSector[id].unservedKwh > 0                                                        |
| Critical sector marker                                                                                                                      | health/water with unservedKwh > 0 or metrics.criticalUnservedKwh > 0                         |
| Time shown                                                                                                                                  | selected step t (0-23), 1 h per step; per-step kW avg == kWh                                 |
| Scene reads the current result only; if status is modified, show last result dimmed with `Scenario modified` and do not animate new values. |

## Interaction

- Click/Tap building opens BuildingPanel (components.md). Hover = outline + tooltip name. Keyboard: Tab through buildings in fixed order, Enter opens, Esc closes.
- Orbit with mouse/touch; wheel zoom limited.
- Always offer an adjacent 2D summary list (per-sector coverage) for a11y and mobile.

## Motion

- Gentle flow animation on active lines only; battery fill eases after run completes.
- prefers-reduced-motion: no flow animation (use static lit lines/dashes), instant camera jumps, no pulses.

## Performance

- Instanced geometry for repeated objects (panels, houses, poles, trees); simple geometry for secondary buildings.
- Limit dynamic shadows (baked/contact shadows); no heavy particle systems.
- Lazy-load (next/dynamic, ssr:false); memoize scene so it rerenders only on result/step/selection change; cap DPR (~1.5-2); usable on integrated GPUs; simulation independent of rendering.

## WebGL fallback

- Detect WebGL on mount (and context loss). Show message `3D visualization is unavailable on this device.` plus functional 2D infrastructure diagram/list: solar, battery SoC, per-sector EnergyBar with coverage, selectable for BuildingPanel.
- Fallback uses the same result; nothing is lost functionally.
