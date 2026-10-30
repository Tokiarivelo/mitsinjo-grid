# 3D Microgrid Scene

Signature element. React Three Fiber + Drei, lazy-loaded. Shown full on /simulation, preview on /overview. Tokens: tokens.md.
Reference visuals: `design/reference/Mitsinjo Grid_ Village at Sunset.png` (master widescreen render at sunset), `design/reference/tableau-de-bord-solaire-futuriste.png` (3D scene in dashboard context), and `design/reference/village-3d-2d-schema.jpg` (canonical 3D & 2D village topology).

## Composition

- Solar array, dual-container BESS battery unit, distribution poles + crossarms + lines, clinic pavilion with emergency vehicle, water pumping station + water reservoir pond, school with rooftop solar, clustered rural houses, communal market with striped canopies, small factory (hall + chimney + silo, north-east behind the clinic), Malagasy red-clay laterite paths, banana plants, acacia trees, rock boulders, horizon sunset ridges.
- Canonical layout (see `design/reference/Mitsinjo Grid_ Village at Sunset.png`):
  - Solar Array: top-left (multi-row ground-mounted PV field, galvanized steel racking + inverter cabinet + telemetry badge)
  - Central Battery BESS: center (dual ISO storage container units + lightning insignia + twin rooftop HVAC pods + SoC LED gauge + security fence + telemetry badge)
  - Water Pump Station: mid-left (elevated galvanized steel lattice water tower + tank + pump house + water reservoir pond with reflective surface)
  - Primary School: top-center/right (elongated rural school building + veranda colonnade + rooftop solar panels + flagpole + telemetry badge)
  - Rural Health Clinic: center-right (stucco dispensary pavilion + terracotta red hipped roof + covered veranda + red cross emblem + parked emergency vehicle + telemetry badge)
  - Village Houses: bottom-left (cluster of 5 authentic rural houses with corrugated tin and thatch roofs + warm glowing windows + verandas)
  - Communal Market: bottom-center/right (open stalls with striped red/yellow/blue canvas awnings + produce crates + festive evening string lights + pickup truck)
- Madagascar-inspired, NOT a surveyed real location (label as simulated).
- Sector mapping: health=Clinic, water=Water pump, school=School, households=Houses, market=Market, industry=Small factory. A sector with `loadMultiplier 0` renders `disconnected`: dim, windows off, badge "Not connected", no coverage.

## Style

- Stylized low-poly diorama at golden hour (reference: `Village at Sunset`): procedural sky dome with sun disc + glow, three layered mountain ridges with aerial haze (valley opened where the sun sets), rolling forested hills (`utils/landscape`), red laterite paths and dirt yards painted into terrain vertex colors, village pond + distant lake, dense rounded canopy forest + palms/bushes/rocks (`ui/vegetation`).
- Light follows the hour (`utils/sky-palette`): golden → warm afternoon by day (sun altitude capped ~36° for long shadows), moonlit blue night; windows and street lamps glow at dusk/night.
- Buildings share `ui/village-house` (walls, hipped roof with eaves, corrugated or tile finish, veranda, glowing windows). Clinic: white walls, slate roof, red-cross sign. Water: lattice tower + tank + pump house. School: long building, red roof, rooftop PV. Houses: 6 homes. Market: 6 striped canvas tents + string lights. Kenney ambulance, pickup and van.
- Legible silhouettes at dashboard scale; essential services identifiable without opening a panel.
- Sleek floating glassmorphism badges (`#0a101d/90` with border `#26364d`) with color-coded sector icons, titles, and live telemetry.
- Avoid: toy/cartoon proportions, excess vegetation, cinematic effects hiding infrastructure.

## Quality tiers & fullscreen

- Toolbar toggle `Quality: High | Low` (`useSceneQuality`, persisted). `high` (default) adds HDRI light, real-time sun shadows, ambient occlusion, bloom and a warm ACES grade; `low` keeps the same composition with lighter forest and a baked contact shadow. A slow device is auto-lowered once (tooltip says so) unless the user chose. Budgets: `docs/performance.md`.
- Fullscreen button (`useFullscreen`) expands the 3D card edge-to-edge; it then shows a stats strip (SIMULATED DATA, solar output, battery SoC, village demand for the selected hour, all engine values).
- `VillageCanvas` props: `model`, `selectedSector`, `onSelectSector`, `cameraPreset`, `cameraResetKey` (`selectedSector` also drives camera focus), optional `quality` override (default = shared tier).
- Assets (`apps/web/public/3d`, CC0, credits in `CREDITS.md`): `nature.glb` (Kenney palms, bushes, rocks), `ambulance|truck|van.glb` (Kenney), `sunset_512.hdr` (Poly Haven, downscaled). Broadleaf trees and all buildings are procedural.

## Camera

- Default front three-quarter view (village in front, hills, lake and sunset behind); smooth orbit; limited zoom range; reset-camera button (aria-label "Reset camera").
- Presets: `Village` (default), `Solar Array`, `Battery`, `EMS Controller`, `Essential Services`. Transitions short and interruptible; never auto-move while user is exploring.
- Selecting a building (3D badge, viewport chips or inspector list) flies the camera to it, then slowly orbits it (`utils/camera-focus`). A drag stops the orbit; deselecting returns to the current preset. Reduced motion: instant jump, no orbit; no GPU: no orbit.

## Energy visual mapping (render only; never compute flows here)

| Visual                                                                                                                                      | Driven by                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solar array glow intensity                                                                                                                  | result.steps[t].solarKw / peak solarKw                                                                                                                              |
| Battery fill + color                                                                                                                        | result.steps[t].socPct (green healthy; warning-amber low; critical-red depleted, with label)                                                                        |
| Battery link line active                                                                                                                    | result.steps[t].batteryKw != 0 (direction from sign; > 0 charging, < 0 discharging)                                                                                 |
| Solar-to-network line lit                                                                                                                   | result.steps[t].solarKw > 0                                                                                                                                         |
| Network-to-building line lit                                                                                                                | metrics.perSector[id].servedKwh > 0 (per step if available)                                                                                                         |
| Building status indicator                                                                                                                   | metrics.perSector[id].coveragePct (full / partial / critical)                                                                                                       |
| Feeder risers + kW tag on each sector cable (hidden when the feeder has no demand and no flow)                                              | `model.buildings[id].servedKw` / `coveragePct`, tone from `feederTone`                                                                                              |
| EMS dispatch controller status & breaker LEDs                                                                                               | `model.controller.mode` (normal, rationing, lifeline_only) & feeder breaker states (`closed` green, `limited` amber, `open` red)                                    |
| Window / string-light glow (PL-T9/PL-T10)                                                                                                   | continuous curve `glowFromIntensity(intensity)` (0 = lights out on zero load or unserved, faint warm glow in lifeline, 1 at peak), scaled by time of day `lampGlow` |
| Street lamps on utility poles (PL-T10)                                                                                                      | `mapPolesToSectors(lines)` follows sector feeder intensity: cut feeder = lamps out (black), lifeline = dimmed, full = bright night glow (1 instanced draw call)     |
| Unmet demand warning (restrained)                                                                                                           | metrics.perSector[id].unservedKwh > 0                                                                                                                               |
| Critical sector marker                                                                                                                      | health/water with unservedKwh > 0 or metrics.criticalUnservedKwh > 0                                                                                                |
| Time shown                                                                                                                                  | selected step t (0-23), 1 h per step; per-step kW avg == kWh                                                                                                        |
| Sky, fog, clouds, rain, lightning                                                                                                           | `model.weather` = weather of the day shown (`utils/weather-atmosphere`, `applyOvercast`); visual only, solar glow still from engine solarKw                         |
| Scene reads the current result only; if status is modified, show last result dimmed with `Scenario modified` and do not animate new values. |

## Interaction

- Click/Tap building opens BuildingPanel (components.md). Hover = outline + tooltip name. Keyboard: Tab through buildings in fixed order, Enter opens, Esc closes.
- Orbit with mouse/touch; wheel zoom limited.
- Always offer an adjacent 2D summary list (per-sector coverage) for a11y and mobile.

## Motion

- Powered cables: lit core + glowing "electron" dots (`ui/electron-flow.tsx`, one InstancedMesh) moving from the
  source toward the consumers, speed, density and emissivity proportional to line flow kW (PL-T11). Cut/idle cables stay dark, no dots.
- The hub→bus feeder carries the engine's `step.servedKw` and always flows toward the bus.
- Battery fill eases after run completes.
- prefers-reduced-motion or modified scenario: electrons frozen in place (still visible), instant camera jumps, no pulses.

## Performance

- Instanced geometry for repeated objects (panels, houses, poles, trees); simple geometry for secondary buildings.
- Limit dynamic shadows (baked/contact shadows); no heavy particle systems.
- Lazy-load (next/dynamic, ssr:false); memoize scene so it rerenders only on result/step/selection change; cap DPR (~1.5-2); usable on integrated GPUs; simulation independent of rendering.

## WebGL fallback

- Detect WebGL on mount (and context loss). Show message `3D visualization is unavailable on this device.` plus functional 2D infrastructure diagram/list: solar, battery SoC, per-sector EnergyBar with coverage, selectable for BuildingPanel.
- Fallback uses the same result; nothing is lost functionally.

## Weather (visual only)

- `WEATHER_ATMOSPHERE[weather]` → cloud cover, overcast, rain, lightning. `applyOvercast` greys the sky palette,
  dims the key light, hides the sun disc, thickens the fog and turns lamps on earlier.
- `ui/weather-effects`: instanced low-poly cloud banks (1 draw call, slow drift), GPU rain streaks (1 draw call,
  time uniform only; 4000 high · 1500 low), storm lightning light (fixed pseudo-random schedule).
- Reduced motion or no GPU: clouds and rain stay still, no lightning flashes.
