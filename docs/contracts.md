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
    };
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
  | 'LIFELINE_SHORTFALL';
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
```

## Copilot tools (LLM-facing; args validated with Zod server-side)

| Tool                 | Args                                                                                    | Returns                                                                         |
| -------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `get_grid_state`     | `{}`                                                                                    | `{ scenarioId, input summary, metrics of active strategy, resultId }`           |
| `run_scenario`       | `{ scenarioId?, patch?: InputPatch, strategy }`                                         | `{ resultId, metrics, warnings }`                                               |
| `compare_strategies` | `{ strategies?: StrategyId[] }` (on current input)                                      | `{ [strategy]: { resultId, metrics } }` (evidence includes lifelineCoveragePct) |
| `get_sector_metrics` | `{ sector: SectorId, strategy?: StrategyId }` (default: active)                         | `SectorMetrics & { priority, hourly: {t,demandKw,servedKw}[] }`                 |
| `propose_change`     | `{ patch?: InputPatch, strategy?: StrategyId, reason: string }` (≥ 1 of patch/strategy) | `{ proposalId }` — **not applied**; UI asks user                                |

```ts
interface InputPatch {
  // all optional; LLM-safe subset
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
}
```

## Copilot HTTP

`POST /api/copilot` body `{ messages: {role:'user'|'assistant', content:string}[], input: SimulationInput }`
→ `text/event-stream` events:
`activity {tool, sector?, label}` (UI translates `tool`; `label` is English, logs only) · `delta {text}` · `evidence {resultId, fields: Record<string, number|string>}` ·
`proposal {proposalId, patch?, strategy?, reason}` · `error {code, message}` · `done {}`.
