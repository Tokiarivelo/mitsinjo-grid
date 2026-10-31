# Contracts — single source of truth

Implement as Zod in `packages/engine/src/schemas/`; export inferred types from `index.ts`.
Changing a field = update this file + schema + tests in the same commit.

## Units

- Horizon 24 h, step `stepH = 1` h → per-step power in **kW** (average) equals energy in **kWh** for that step.
- Power fields end with `Kw`, energy fields `Kwh`, percentages `Pct` (0–100), ratios 0–1 (no suffix).
- `batteryKw` > 0 = charging, < 0 = discharging.

## Ids

```ts
type SectorId = 'health' | 'water' | 'school' | 'households' | 'market' | 'industry'; // SECTOR_IDS
type Priority = 'critical' | 'high' | 'medium' | 'low';
type StrategyId = 'proportional' | 'essential_first' | 'balanced'; // balanced = stretch
type SimStatus = 'ready' | 'modified' | 'running' | 'complete' | 'error';
type ScenarioId =
  | 'baseline'
  | 'cloudy_afternoon'
  | 'high_demand'
  | 'battery_constraint'
  | 'essential_stress'
  | 'meter_anomaly';
```

```ts
// PV vision insert (schemas/appliance.ts)
type ApplianceCategory =
  | 'fridge'
  | 'freezer'
  | 'tv'
  | 'lamp'
  | 'fan'
  | 'laptop'
  | 'phone_charger'
  | 'radio'
  | 'water_pump'
  | 'rice_mill'
  | 'sewing_machine'
  | 'welder'
  | 'fridge_vaccine'
  | 'computer'
  | 'other'; // APPLIANCE_CATEGORIES
interface ApplianceSpec {
  category: ApplianceCategory;
  defaultW: number;
  minW: number;
  maxW: number; // W, min ≤ default ≤ max
  hourlyDuty: number[];
} // 24 values 0–1 (HourlyDutySchema)
interface Appliance {
  id: string; // 1–64, unique in the list
  name: string; // 1–40 (trimmed)
  category: ApplianceCategory;
  sector: SectorId;
  watts: number; // one unit, within APPLIANCE_CATALOG[category] minW–maxW
  quantity: number; // int 1–50
  hourlyDuty?: number[]; // 24 values 0–1, default = catalog profile
}
```

## Input

```ts
interface SectorConfig {
  id: SectorId;
  label: string;
  priority: Priority;
  criticalShare: number; // 0–1, part of demand that is critical (health 0.8, others lower)
  profileKw: number[]; // length 24, hourly demand kW
  flexible: boolean; // shiftable load (water pump) — used only by stretch features
  meterReadings?: number[]; // length 24, optional measured demand override
  lifelineKw?: number; // ≥ 0, survival power floor (kW; defaults in DEFAULT_LIFELINE_KW)
  loadMultiplier?: number; // 0–3, live load factor on profileKw (absent = 1, 0 = not connected)
}
interface BatteryConfig {
  capacityKwh: number;
  initialSocPct: number;
  minSocPct: number;
  maxChargeKw: number;
  maxDischargeKw: number;
  chargeEff: number;
  dischargeEff: number; // 0–1
}
interface SolarConfig {
  peakKw: number;
  profile: number[];
} // profile length 24, 0–1
type ScenarioEvent =
  | { type: 'solar_drop'; startHour: number; durationH: number; factor: number } // factor 0.6 = −40 %
  | {
      type: 'demand_spike';
      sector: SectorId | 'all';
      startHour: number;
      durationH: number;
      factor: number;
    }
  | { type: 'fire'; sector: SectorId; startHour: number; durationH: number }; // F1: sector at 0 kW, beats caps + floor
interface SectorCap {
  sector: SectorId;
  maxKw: number; // ≥ 0
  fromHour: number; // 0–23
  toHour: number; // 1–24, fromHour < toHour
}
interface SimulationInput {
  scenarioId: ScenarioId | 'custom';
  horizonH: 24;
  stepH: 1;
  solar: SolarConfig;
  battery: BatteryConfig;
  sectors: SectorConfig[];
  events: ScenarioEvent[];
  demandMultiplier: number; // global, 0.5–2
  sectorCaps?: SectorCap[];
  strategyParams?: {
    balancedWeights?: Record<Priority, number>;
    lifeline?: { enabled: boolean }; // default enabled
  };
  appliances?: Appliance[]; // ≤ MAX_APPLIANCES (30); absent = none (PV)
}
```

Validation bounds (Zod, reject — never silently clamp): `peakKw 0–500`, `capacityKwh 1–2000`,
`initialSocPct/minSocPct 0–100` with `min < initial`, effs `0.5–1`, `factor 0–3`,
`startHour 0–23`, `startHour + durationH ≤ 24`, `durationH 1–24`, exactly `SECTOR_IDS.length` (6) sectors with unique ids, `sector.loadMultiplier 0–3`,
`sector.lifelineKw ≥ 0` (defaults: health 0.3, water 0.2, school 0.1, households 0.4, market 0.1, industry 0),
`sectorCaps` `maxKw 0–500`, `fromHour 0–23`, `toHour 1–24`, `fromHour < toHour`,
`strategyParams.balancedWeights` weights 0–10, at least one > 0 (defaults 4/3/2/1),
`strategyParams.lifeline.enabled` boolean (default true).

## Result

```ts
type SectorMode = 'full' | 'limited' | 'lifeline' | 'off';

interface SectorStep {
  demandKw: number;
  servedKw: number;
  criticalDemandKw: number;
  criticalServedKw: number;
  lifelineServedKw: number;
  mode: SectorMode;
}
interface StepResult {
  t: number; // hour index 0–23
  solarKw: number;
  demandKw: number;
  servedKw: number;
  unservedKw: number;
  batteryKw: number;
  socPct: number;
  curtailedKw: number;
  sectors: Record<SectorId, SectorStep>;
}
interface SectorMetrics {
  demandKwh: number;
  servedKwh: number;
  unservedKwh: number;
  coveragePct: number;
}
interface Metrics {
  demandKwh: number;
  servedKwh: number;
  unservedKwh: number;
  criticalDemandKwh: number;
  criticalUnservedKwh: number;
  criticalUnmetHours: number;
  criticalCoveragePct: number; // essential-services coverage shown in UI (from criticalShare, all sectors)
  lifelineCoveragePct: number; // % of sector-hours where the cap-aware lifeline floor is held
  affectedSectors: SectorId[]; // sectors with unservedKwh > ε
  solarKwh: number;
  curtailedKwh: number;
  socStartPct: number;
  socEndPct: number;
  socMinPct: number;
  violations: number; // must be 0; engine self-checks invariants
  perSector: Record<SectorId, SectorMetrics>;
}
type WarningCode =
  | 'CRITICAL_UNMET'
  | 'SECTOR_PARTIAL'
  | 'RESERVE_REACHED'
  | 'CURTAILMENT'
  | 'ANOMALY_TO_VERIFY'
  | 'SECTOR_CAPPED'
  | 'LIFELINE_SHORTFALL'
  | 'FIRE_ISOLATION'; // sector cut by a fire event (one range per sector)
interface SimWarning {
  code: WarningCode;
  sector?: SectorId;
  fromHour: number;
  toHour: number;
}
interface SimulationResult {
  id: string; // 'SIM-' + first 6 hex of inputHash+strategy, stable
  inputHash: string; // deterministic hash of canonical JSON input
  strategy: StrategyId;
  steps: StepResult[]; // length 24
  metrics: Metrics;
  warnings: SimWarning[];
  engineVersion: string;
}
type Comparison = Record<StrategyId, SimulationResult>; // only strategies requested
```

### Weather workflow (multi-day)

```ts
type WeatherId = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'storm';
type Workflow = { weather: WeatherId }[]; // 1..MAX_WORKFLOW_DAYS (7)
type WorkflowTotals = {
  demandKwh;
  servedKwh;
  unservedKwh;
  criticalUnservedKwh;
  criticalUnmetHours;
  solarKwh;
  socStartPct;
  socEndPct;
  socMinPct;
  violations;
}; // sums; SoC start=day 1, end=last day, min=over all days
type WorkflowResult = {
  strategy: StrategyId;
  days: { day: number; weather: WeatherId; result: SimulationResult }[];
  totals: WorkflowTotals;
};
type WorkflowComparison = Record<StrategyId, WorkflowResult>; // only strategies requested
```

Store (`useSimulationStore`): `workflow` (default `[{ weather: 'sunny' }]` = plain 24 h run), `workflowResults`,
`dayIndex`; `results` is always the comparison of day `dayIndex`. Actions `addWorkflowDay`, `removeWorkflowDay`,
`setDayWeather` (re-run at once when the run was `complete`, else → `modified`; same for add/remove), `setDayIndex`, `advancePlayback` (hour +1, rolls over to next day, loops to day 1).
`source: 'scenario' | 'device'` (PH): `applyDeviceRun({ scenarioId, patch, strategy, simHour })` loads the scenario,
applies the bridge patch, sets the strategy and hour, one-day workflow, then `run()` → `source = 'device'`,
`deviceHourMs = scale.timeScale × 1000` (null without `scale`); selectors `selectFollowsDevice`, `selectDeviceHourMs`;
`releaseDevice()` and `loadScenario` set `source = 'scenario'`.

Fire (M2): engine `activeFires(events, t): FireEvent[]`, `effectiveSectorCaps(input)` = caps + one 0 kW cap per fire.
Store `reportFire(sector)` adds `{ type: 'fire', sector, startHour: timeIndex, durationH: 24 − timeIndex }` and re-runs at
once (safety exception: no approval, not in `changeHistory`; no-op if that sector already burns). `BuildingSceneModel.onFire`
= burning at the shown hour; `feederTone` → `critical-red`, 2D wire `cut`.

3D `SceneModel.weather: WeatherId` (from `toSceneModel({ weather })`, default `sunny`): drives sky, clouds and rain only.

### 3D and 2D SceneModel Controller & Intensity Lighting (PL-T5, PL-T9..PL-T13)

```ts
type ControllerMode = 'normal' | 'rationing' | 'lifeline_only';
type BreakerState = 'closed' | 'limited' | 'open';
type WireState = 'flow' | 'lifeline' | 'cut' | 'idle';

interface FeederSceneModel {
  mode: SectorMode;
  servedKw: number;
  intensity: number; // 0..1 relative to peak served kW of the sector
  share: number; // 0..1 of the kW the controller dispatches this hour (bar segment width only)
  breaker: BreakerState;
}

interface ControllerSceneModel {
  mode: ControllerMode;
  feeders: Record<SectorId, FeederSceneModel>;
}

interface SectorPole {
  x: number;
  z: number;
  sectorId: SectorId | null;
}
```

`SceneModel.controller: ControllerSceneModel` (pure display mapping from `toSceneModel`, shared across 3D digital twin and 2D single-line circuit / topology diagram). Camera preset `'controller'` frames the shelter at `BUS_POSITION`.
Every sector cable starts at `feederExitPosition(id)` (one riser per feeder on the controller roof, ordered west → east by `FEEDER_EXIT_X`); the hub cable ends at `BUS_INLET_POSITION`. Display tone of a feeder = `feederTone(feeder, building)` (`utils/feeder-tone.ts`), shared by the 3D LEDs/risers/tags and both diagrams. `DiagramLayout` adds `feederTags` (kW tag box per feeder), `wires.controllerToBus` (topology: hub → EMS → bus) and `enclosure` (circuit: EMS switchboard around bus bar + breakers).

**Intensity-Driven Lighting (PL-T9..PL-T13):**

- **3D Windows & Market Lights:** `glowFromIntensity(intensity)` (`utils/scene-palette.ts`) replaces discrete status lookup with a continuous curve: 0 → black/off (zero load or unserved), ~0.25 → faint warm glow at lifeline floor, 1 → full radiant light. Multiplied by `lampGlow` (sky time-of-day).
- **3D Street Lamps:** `mapPolesToSectors(lines)` (`utils/cable-route.ts`) maps utility poles to their powering sector feeder. Unserved/cut feeders shut off pole street lamps (black); lifeline feeders dim them; trunk poles (no feeder) stay lit while the bus is energized. Single instanced draw call (`pole-lamps`).
- **3D Particles (`ElectronFlow`):** Speed, electron count/density, and bloom emissivity scale with line flow kW via `flowFactor(flowKw)` (`utils/scene-palette.ts`, saturates at `FLOW_SATURATION_KW`). Cut lines have zero particles.
- **2D Diagrams (`GridDiagram`, `FlowWire`, `SectorCard`):** Core and halo stroke width & opacity scale with feeder intensity. Lifeline mode is represented by amber dashed line (`strokeDasharray="4 4"`). Cut lines are neutral grey (`text-text-muted`, dashed, no electrons). Building cards render `servedKw / demandKw`, mode badges (`full`, `limited`, `lifeline`, `off`), and intensity-driven glow halos via semantic `@theme` tokens. All text labels follow 100% key parity in EN/FR/MG. Reduced motion halts electron flow in both 2D and 3D.

### Sensitivity sweep

```ts
type SweepParam = 'solarDropPct' | 'demandMultiplier' | 'initialSocPct';
interface SweepConfig {
  param: SweepParam;
  from: number;
  to: number;
  step: number; // point count between 1 and 20
}
interface SweepPoint {
  value: number;
  metrics: Partial<Record<StrategyId, Metrics>>;
}
type SweepResult = SweepPoint[]; // length ≤ 20
```

## Engine public API (`@mitsinjo/engine`)

```ts
simulate(input: SimulationInput, strategy: StrategyId): SimulationResult
compare(input: SimulationInput, strategies?: StrategyId[]): Comparison
compareLifelineCoverage(comparison: Comparison): LifelineComparisonSummary
sweep(input: SimulationInput, config: SweepConfig, strategies?: StrategyId[]): SweepResult // ≤ 20 points

Points use the same mapping as `applyPatch`; both range ends are validated, so an invalid range (e.g. `initialSocPct ≤ minSocPct`) throws `ZodError`.
applyWeather(input: SimulationInput, weather: WeatherId): SimulationInput // solar profile × WEATHER_SOLAR_FACTOR
simulateWorkflow(input: SimulationInput, workflow: Workflow, strategy: StrategyId): WorkflowResult // throws ZodError
compareWorkflow(input: SimulationInput, workflow: Workflow, strategies?: StrategyId[]): WorkflowComparison
parseInput(raw: unknown): SimulationInput             // throws ZodError
applyPatch(input: SimulationInput, patch: InputPatch): SimulationInput
isSectorConnected(sector: SectorConfig): boolean     // loadMultiplier !== 0
connectedSectors(input): SectorConfig[] · connectedSectorIds(input): SectorId[]
getSolarDrop(input: SimulationInput): { pct; startHour; durationH } // defaults 12 h / 3 h (DEFAULT_DROP_*) when no drop
scenarios: Record<ScenarioId, { title: string; description: string; input: SimulationInput }>
STRATEGIES: Record<StrategyId, { label: string; rule: string }>
// Dispatch display state (shared by 3D, 2D and the scale model)
breakerFromMode(mode: SectorMode): BreakerState      // lifeline → limited · full/limited → closed · off → open
feederModeAt(input, result, hour, sector): SectorMode // disconnected → 'off'
controllerModeAt(input, result, hour): ControllerMode
flowLevel(flowKw: number): number                    // 0–1, saturates at FLOW_SATURATION_KW (3); web alias flowFactor
feederTone({ connected, demandKw, servedKw, breaker }): FeederTone // 'ok'|'warning'|'critical'|'idle'; web maps to StatusColor
// Physical scale model (PH)
scaleTelemetry(samples: TelemetrySample[], scale: HardwareScale, base: SimulationInput): InputPatch
toHardwareCommand(input, result, hour, scale, seq?): HardwareCommand
feederNominalKw(scale, sector): number               // nominalW × powerScale / 1000
DEFAULT_HARDWARE_SCALE                               // powerScale 4000, timeScale 20, luxFullSun 20000
TIME_SCALE_PRESETS                                   // [60, 20, 10, 5] s per simulated hour (app speed buttons)
// Appliances (PV)
APPLIANCE_CATALOG: Record<ApplianceCategory, ApplianceSpec> // read-only
applianceProfileKw(appliance: Appliance): number[]  // 24 kW: watts × quantity × duty / 1000
sectorApplianceKw(appliances?): Partial<Record<SectorId, number[]>> // summed per sector
```

### Physical scale model (PH, `schemas/hardware.ts`)

```ts
type ControllerMode = 'normal' | 'rationing' | 'lifeline_only'; // ControllerModeSchema
type BreakerState = 'closed' | 'limited' | 'open'; // BreakerStateSchema
interface HardwareScale {
  powerScale: number; // 1–100000; 4000 → 1 W model = 4 kW simulated
  timeScale: number; // 1–3600; 20 → 1 simulated hour = 20 s
  luxFullSun: number; // > 0; reference lux = clear-sky hour
  nominalW: Record<SectorId, number>; // 0–50 W at 100 % duty, all sectors required
}
interface ChannelReading {
  mV: number;
  mA: number;
}
interface TelemetryFrame {
  v: 1;
  deviceId: string;
  seq: number;
  uptimeMs: number;
  lux: number;
  pv: ChannelReading;
  battery: ChannelReading; // safety only, never the grid SoC
  feeders: Record<SectorId, ChannelReading>; // served current (check only, never demand)
  requests: Record<SectorId, number>; // 0–1 demand request (switch / potentiometer)
}
interface TelemetrySample {
  simHour: number; // 0–23, set by the bridge
  lux: number;
  requests: Partial<Record<SectorId, number>>;
}
interface HardwareCommand {
  v: 1;
  seq: number;
  simHour: number;
  mode: ControllerMode;
  socPct: number;
  batteryKw: number; // engine values
  feeders: Record<
    SectorId,
    { duty: number; breaker: BreakerState; flow: number; tone: FeederTone }
  >; // duty, flow 0–1
}
// apps/bridge → web over WebSocket: { type: 'state', state: BridgeState } every second
// Zod: BridgeStateSchema / BridgeMessageSchema / BridgeModeSchema in schemas/hardware.ts (shared by bridge and web)
interface BridgeState {
  v: 1;
  mode: 'replay' | 'twin';
  scenarioId: ScenarioId;
  strategy: StrategyId;
  day: number;
  simHour: number;
  patch: InputPatch; // apply to scenarios[scenarioId].input and re-run to get the same numbers
  deviceOnline: boolean; // a valid frame in the last 5 s
  scale: HardwareScale;
  command: HardwareCommand;
}
// bridge → web (BridgeMessageSchema): { type: 'state', state: BridgeState } each second
//   | { type: 'access', control: boolean } once per connection (false = read-only, commands ignored)
// connection URL ?token=<BRIDGE_TOKEN> → control; no BRIDGE_TOKEN set → everyone controls
// web → bridge (BridgeClientMessageSchema):
//   { type: 'cloud', on: boolean } → MQTT mitsinjo/v1/cloud (servo over the sun lamp)
//   { type: 'speed', timeScale: number } → new pace from the current hour (no jump); next state confirms it
```

MQTT topics: `mitsinjo/v1/telemetry` (device → bridge), `mitsinjo/v1/command` (bridge → device),
`mitsinjo/v1/cloud` (bridge → device).

`scaleTelemetry`, measured hour h: `solarProfile[h] = base.profile[h] × clamp(mean lux / luxFullSun, 0, 1)`;
`meterReadings[s][h] = computeProfileDemandKw(s, h) × mean request`. Unmeasured hours keep the base profile and the
expected demand. `toHardwareCommand`: `duty = clamp(servedKw / feederNominalKw, 0, 1)`, `breaker = breakerFromMode`,
`flow = flowLevel(servedKw)`, `mode = controllerModeAt`, `socPct` from the step.

## Copilot tools (LLM-facing; args validated with Zod server-side)

| Tool                 | Args                                                                                        | Returns                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `get_grid_state`     | `{ hourly?: boolean }`                                                                      | `{ scenarioId, input summary, metrics of active strategy, resultId, hourly?, highlights? }` |
| `run_scenario`       | `{ scenarioId?, patch?: InputPatch, strategy }`                                             | `{ resultId, metrics, warnings }`                                                           |
| `compare_strategies` | `{ strategies?: StrategyId[] }` (on current input)                                          | `{ [strategy]: { resultId, metrics } }` (evidence includes lifelineCoveragePct)             |
| `get_sector_metrics` | `{ sector: SectorId, strategy?: StrategyId }` (default: active)                             | `SectorMetrics & { priority, hourly: {t,demandKw,servedKw}[] }`                             |
| `propose_change`     | `{ patch?: InputPatch, strategy?: StrategyId, reason: string }` (≥ 1 of patch/strategy)     | `{ proposalId, impact: ChangeImpact }` — **not applied**; UI asks user                      |
| `control_playback`   | `{ action: 'play'\|'pause'\|'stop'\|'restart'\|'seek', hour?: 0–23 }` (`seek` needs `hour`) | `{ status: 'applied_in_app', action, hour?, note }` + SSE `control`; view only              |

`control_playback` is the one tool the app runs without approval: it only moves the 24 h playback / time cursor
(`applyPlaybackControl` → store `play/pause/stop/restart/setTimeIndex`; seek pauses first). Inputs, strategy and
results never change, so it is not a "mutation" in the `propose_change` sense.

`get_grid_state({hourly:true})` adds `hourly: {t, solarKw, demandKw, socPct}[24]` (engine steps, rounded) and `highlights
{ peakSolarKw, peakSolarHour, peakDemandKw, peakDemandHour, lowestSocPct, lowestSocHour }` (picked from the steps), also in
evidence. Charts in answers must use these values.

`ChangeImpact` (engine `changeImpact(before, after)`, schema `ChangeImpactSchema`): `{ beforeResultId, afterResultId,
strategyBefore, strategyAfter, socMinPctBefore/After, unservedKwhBefore/After, sectors: Partial<Record<SectorId,
{ servedKwhBefore, servedKwhAfter, servedKwhDelta, offHoursBefore, offHoursAfter }>> }`. `propose_change` computes it
on the current input + active strategy vs the patched input + proposed strategy (`proposalImpact` in
`lib/proposal-impact.ts`, shared with the dialog), rounds to 2 decimals, keeps only sectors that change, and emits the same numbers as `evidence` (`socMinPctBefore`, `<sector>_servedKwhDelta`, …).
Unsafe patch → tool data also has `clinicGuard: ClinicGuardReason[]` (engine `clinicGuard(patch)`, schema
`ClinicGuardReasonSchema` = `cap_zero | disconnected | floor_zero | lifeline_off`); the dialog recomputes it from the patch.
Partial approval (K3, `features/copilot/utils/proposal-parts.ts`): `proposalPartIds(proposal)` = one id per dialog line
(`strategy`, `priorities.<s>`, `sectorCaps.<i>`, `solarDropPct`, `dropWindow`, `demandMultiplier`, `batteryCapacityKwh`,
`initialSocPct`, `minSocPct`, `lifeline.enabled`, `lifeline.kw.<s>`, `sectorLoads.<s>`), same order as `useProposalDiff`.
`pickProposal(proposal, checkedIds): { patch?, strategy? }` keeps the checked lines plus patch fields with no line.

```ts
interface InputPatch {
  // all optional; LLM-safe subset
  solarProfile?: number[]; // length 24, 0–1 → replaces solar.profile (measured by the scale model, PH)
  solarDropPct?: number; // 0–90 → adds/replaces a solar_drop event
  dropStartHour?: number;
  dropDurationH?: number;
  demandMultiplier?: number; // 0.5–2
  batteryCapacityKwh?: number;
  initialSocPct?: number;
  minSocPct?: number;
  priorities?: Partial<Record<SectorId, Priority>>;
  sectorCaps?: SectorCap[];
  meterReadings?: Partial<Record<SectorId, number[]>>;
  criticalShares?: Partial<Record<SectorId, number>>; // 0–1
  balancedWeights?: Partial<Record<Priority, number>>; // 0–10, at least one > 0
  lifeline?: { enabled?: boolean; kw?: Partial<Record<SectorId, number>> }; // 0–2 kW
  sectorLoads?: Partial<Record<SectorId, number>>; // 0–3 → loadMultiplier (1 removes it, 0 disconnects)
  appliances?: Appliance[]; // replaces the list; [] removes the field (hash unchanged)
}
```

## Copilot HTTP

`POST /api/copilot` body `{ messages: {role:'user'|'assistant', content:string, media?: {type, url, key?}[]}[] /*≤ 40: those not in the summary*/, input: SimulationInput, strategy?, model?, locale?, sessionId?, hour? /*0–23, shown hour: village image + "now" for caps (system note)*/, summary?: string /*≤ 4000*/, summarizedCount?: int /*payload messages before `messages`*/, retry?: boolean /*same question again; question not saved twice*/ }`.
Client `ChatMessageData.retried?: boolean` = answer redone by Retry (kept on screen, left out of the payload)
→ `text/event-stream` events:
`activity {tool, sector?, label}` (UI translates `tool`; `label` is English, logs only) · `delta {text}` · `evidence {resultId, fields: Record<string, number|string>}` ·
`proposal {proposalId, patch?, strategy?, reason, impact?: ChangeImpact}` · `error {code, reason?, message}` · `done {}` ·
`model {model, modality, reason}` (modality `chat|reasoning|vision|image`; a second `model` event announces a switch to Wonder) · `image {imageUrl, caption}` ·
`perception {kind:'segment', concept, count, boxCoverage, instances[], imageWidth, imageHeight, source, model, fallback?}` ·
`control {action, hour?}` (playback command from `control_playback`; client applies it, `ChatMessageData.control` shows a cyan line) ·
`summary {text, summarizedCount}` (history folded into the summary; client sends only later messages, session stores both).
`error.code = PROVIDER_FALLBACK` carries `reason: 'spend_cap' | 'provider_error' | 'timeout'` (UI: amber note on that answer).

Operator decision (chat message `role: 'decision'`, saved via `POST /api/copilot/sessions/:id`): `ProposalDecision
{ proposalId, status: 'approved'|'rejected'|'undone', items: {id?, label, current, proposed}[] /*snapshot as shown, checked lines*/,
skipped?: same[] /*lines unchecked (K3), not applied*/, patch?, strategy? /*what was applied*/ }`.
Approved with `skipped` → the model text adds « Lines the operator left out (NOT applied): … ».
Sent to the model as a user turn `[Operator decision] APPROVED|REJECTED|UNDID proposal <id>…`.
Store (K4): `changeHistory: { id, before: { input, strategy } }[]` (≤ 20, oldest first). `approveChange(id, patch?, strategy?)` =
`applyProposal` + records the state before it (only if the run succeeds); `undoLastChange(): id | null` restores it and re-runs.
Cleared by `loadScenario`, `reset`, `applyDeviceRun`. Plain `applyProposal` (sector sliders) is not recorded; an undo also
drops later slider edits (it restores the whole input). Session GET adds `summary?, summarizedCount?`.

`POST /api/voice` multipart `{ audio: WAV ≤ 2 MB (≈ 60 s 16 kHz mono), locale?, sessionId? }` → `{ text, durationMs, source:
'meta'|'mock', fallback? }`; 400 missing, 413 too big, 415 not WAV. Audio is not stored.

Model-switch tools (Zod in `server/copilot/model-tools.ts`, results go back to the model):
`generate_image {scene:'current_village'|'custom', prompt? /*custom*/, caption?}` → `{ok, model, caption, shownState?:{hour, sky, battery, sectors}}` + `image` event · `segment_image {concept}` →
`{concept, count, boxCoverage, model, source, note}` + `perception` event · `escalate_deep_reasoning {reason}` → `{ok, model}` + `model` event.
Invalid args or failure → `{error}`.

## Perception (`server/perception`, Zod in `schemas.ts`)

Observations, never energy values: any number must become an `InputPatch` proposal before the engine uses it.
Every result carries `{ source: 'meta'|'mock', model, fallback?: 'provider_error'|'spend_cap'|'not_configured' }`.

```ts
Transcript { text; durationMs; turns: { startMs; endMs; text; speaker? }[] }
VisionResult { summary; observations: { label; value: number|string|boolean; unit?; confidence /*0–1*/ }[] }
SegmentResult { concept; imageWidth; imageHeight; instances: { box:{x1,y1,x2,y2}; confidence?; outline? /*SVG path 0–1*/ }[]; count; boxCoverage /*0–1*/ }
// PV: appliances on a photo. Labels + geometry only, never watts (the engine catalog gives power).
DetectionResult { detections: { id /*det-n*/; label /*1–40*/; category: ApplianceCategory; confidence? /*0–1*/;
  box: { x; y; w; h } /*image fractions 0–1, top-left*/; outline? /*SVG path, 0–1*/ }[] /*≤ 20*/ }
```
