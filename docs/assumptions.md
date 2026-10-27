# Model Assumptions & Boundaries — Mitsinjo Grid

> **SIMULATED DATA DISCLOSURE**: Mitsinjo Grid is a decision-support and educational simulation platform. All energy figures, solar generation curves, battery states, and village demand figures are synthetic model outputs, not live telemetry from physical microgrid hardware.

This document formalizes the modeling boundaries, physical assumptions, mathematical equations, and scenario parameters implemented in `@mitsinjo/engine`.

---

## 1. Simulation Horizon & Resolution

- **Time Horizon**: Fixed 24-hour cycle corresponding to a full daily diurnal pattern ($t \in [0, 23]$, where $t = 0$ is 00:00 and $t = 23$ is 23:00).
- **Time Step ($\Delta t$)**: Discrete 1-hour steps ($\Delta t = 1.0\text{ h}$). All power figures in kilowatts ($\text{kW}$) over $\Delta t = 1\text{ h}$ equal kilowatt-hours ($\text{kWh}$).
- **Single-Bus Topology**: The microgrid is modeled as a unified copper-plate AC/DC bus. Real power is conserved at every step:
  $$\text{servedKw} = \text{solarKw} - \text{batteryKw} - \text{curtailedKw}$$
  where $\text{batteryKw} > 0$ represents charging (absorption) and $\text{batteryKw} < 0$ represents discharging (injection).

---

## 2. Solar Photovoltaic Generation

- **Installed Capacity**: $40.0\text{ kWp}$ rated DC peak output under Standard Test Conditions (STC: $1000\text{ W/m}^2$, $25^\circ\text{C}$).
- **Diurnal Profile**: Bell-shaped generation profile running from 06:00 to 18:00 local time:
  - Sunrise: 06:00 ($t = 6$, solar begins).
  - Solar Noon Peak: 12:00 ($t = 12$, normalized factor $0.485$ corresponding to $\approx 19.4\text{ kW}$).
  - Sunset: 18:00 ($t = 18$, solar ceases).
  - Effective Peak Sun Hours (PSH): $\approx 3.1\text{ PSH}$, delivering $\approx 124\text{ kWh/day}$ under baseline conditions.
- **Weather Disturbance Modeling**:
  $$\text{solarKw}(t) = \text{solar.peakKw} \times \text{solar.profile}[t] \times \prod_{w \in \text{weatherEvents}(t)} w.\text{factor}$$
  A cloud event at $t = 13$ with factor $0.6$ temporarily suppresses solar output to $60\%$ of expected irradiance for its duration.

---

## 3. Battery Energy Storage System (BESS)

- **Nominal Capacity ($C\_{\text{bat}}$)**: $120.0\text{ kWh}$ nominal storage.
- **State of Charge (SoC)**:
  - Initial SoC ($\text{SoC}_0$): $60\%$ default ($72.0\text{ kWh}$ usable stored energy at baseline start).
  - Reserve Minimum ($\text{SoC}_{\min}$): $20\%$ default ($24.0\text{ kWh}$). The battery controller strictly forbids discharging below this threshold to protect cell longevity and maintain emergency reserve:
    $$\text{reserveKwh} = \frac{\text{minSoc}}{100} \times C_{\text{bat}}$$
- **Power Rating & Limits**:
  - Maximum Charge Rate: $+25.0\text{ kW}$.
  - Maximum Discharge Rate: $-25.0\text{ kW}$.
- **Efficiency ($\eta$)**:
  - One-way charging efficiency $\eta_{\text{ch}} = 0.95$ ($95\%$).
  - One-way discharging efficiency $\eta_{\text{dis}} = 0.95$ ($95\%$).
  - Round-trip efficiency $\eta_{\text{RT}} = \eta_{\text{ch}} \times \eta_{\text{dis}} \approx 90.25\%$.
- **Energy Balance Invariants**:
  $$\text{storedKwh}(t+1) = \text{storedKwh}(t) + \max(\text{batteryKw}, 0) \times \eta_{\text{ch}} - \frac{\max(-\text{batteryKw}, 0)}{\eta_{\text{dis}}}$$
  Guaranteed within tolerance $\varepsilon = 10^{-9}$ across all simulation steps.

---

## 4. Village Demand & Sector Prioritization

Baseline village daily consumption totals $\approx 126\text{ kWh/day}$ (engine output; spec target $\approx 128$) distributed across 5 community infrastructure sectors:

| Sector                         | Priority Tier | Critical Share ($\chi$) | Base Profile (kW)                         | Daily Baseline            | Primary Lifeline Function                                                                     |
| :----------------------------- | :------------ | :---------------------- | :---------------------------------------- | :------------------------ | :-------------------------------------------------------------------------------------------- |
| **Health Clinic** (`health`)   | `critical`    | $80\%$ ($0.80$)         | 0.6 kW night, 1.2 kW (08–18h)             | $\approx 20.4\text{ kWh}$ | Vaccine refrigeration cold chain, emergency room, delivery ward lighting, infant incubators.  |
| **Water Pumping** (`water`)    | `high`        | $30\%$ ($0.30$)         | 3.0 kW (08–16h), 0 kW night               | $\approx 24.0\text{ kWh}$ | Borehole submersible pump filling communal elevated cistern. Highly flexible during sunlight. |
| **School** (`school`)          | `medium`      | $10\%$ ($0.10$)         | 1.5 kW (07–16h), 0 kW night               | $\approx 13.5\text{ kWh}$ | Classroom lighting, digital tablet charging, administrative office.                           |
| **Residential** (`households`) | `medium`      | $20\%$ ($0.20$)         | 1.0 kW day, 6.0 kW (18–22h), 1.5 kW night | $\approx 50.0\text{ kWh}$ | Domestic LED lighting, mobile phone charging, evening social hours.                           |
| **Local Market** (`market`)    | `low`         | $10\%$ ($0.10$)         | 2.0 kW (08–18h), 0 kW night               | $\approx 20.0\text{ kWh}$ | Small trade kiosks, evening beverage refrigeration, repair workshops.                         |

- **Critical vs. Non-Critical Demands**:
  $$\text{demand}_s(t) = \text{profile}_s[t] \times \text{demandMultiplier} \times \prod \text{spikes}$$
  $$\text{critical}_s(t) = \text{demand}_s(t) \times \chi_s$$
  $$\text{discretionary}_s(t) = \text{demand}_s(t) \times (1 - \chi_s)$$

---

## 5. Dispatch Strategies

When total available energy ($\text{availableKw} = \text{solarKw} + \text{dischargeMaxKw}$) is strictly less than total demand ($\text{demandKw}$), an energy allocation deficit occurs:

### A. Proportional Allocation (`proportional`)

- **Philosophy**: Uniform shedding across all loads regardless of social function.
- **Formula**:
  $$\text{served}_s(t) = \text{demand}_s(t) \times \min\left(1, \frac{\text{availableKw}(t)}{\text{demandKw}(t)}\right)$$
- **Deficit Outcome**: When a deficit strikes, the clinic, school, water pump, and market all receive the exact same percentage reduction. If available power is $60\%$ of demand, the clinic only receives $60\%$ of its power—violating its $80\%$ critical requirement and causing vaccine spoilage warnings.

### B. Essential-First Allocation (`essential_first`)

- **Philosophy**: Strict tiered lexicographic priority honoring social lifeline hierarchy:
  $$\text{critical} > \text{high} > \text{medium} > \text{low}$$
- **Algorithm**:
  1. Priority tier `critical` (Health Clinic) is fully served up to $100\%$ of its demand before any other tier receives power.
  2. If power remains, priority tier `high` (Water Pump) is served.
  3. If power remains, priority tier `medium` (School and Households) is shared proportionally.
  4. If power remains, priority tier `low` (Local Market) receives the remainder.
- **Deficit Outcome**: Under afternoon cloud cover, the clinic maintains $100\%$ coverage with $0\text{ kWh}$ critical deficit, preserving vaccines while gracefully curtailing market kiosks and domestic loads.

### C. Balanced Distribution (`balanced`)

- **Philosophy**: Two-pass humanitarian water-filling algorithm.
- **Pass 1**: Allocate power to fulfill the critical lifeline fraction ($\text{critical}_s$) of all sectors first.
- **Pass 2**: Distribute remaining available energy using weighted priorities ($\text{critical}: 4, \text{high}: 3, \text{medium}: 2, \text{low}: 1$) with iterative capping at each sector's remaining demand.

---

## 6. Preconfigured Scenarios

| Scenario ID                      | Name               | Description & Parameters                                                               | Expected Behavior                                                                                                                                                                                                                                                                                                                 |
| :------------------------------- | :----------------- | :------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `baseline`                       | Nominal Baseline   | Standard sunny day, full solar curve, $60\%$ initial SoC.                              | $100\%$ coverage across all sectors, $0\text{ kWh}$ unserved, battery ends at $\approx 55\%$.                                                                                                                                                                                                                                     |
| `cloudy_afternoon` _(Demo Hero)_ | Cloudy Afternoon   | Solar drops by $40\%$ ($\times 0.60$) between 13:00 and 15:00, initial SoC $35\%$.     | Battery reaches the $20\%$ reserve at 23:00 ($\approx 1.2\text{ kWh}$ unserved that hour). `proportional`: clinic short $\approx 0.33\text{ kWh}$ ($\approx 0.21\text{ kWh}$ critical, essential coverage $\approx 99.4\%$). `essential_first`: $0\text{ kWh}$ critical deficit, clinic $100\%$, households absorb the shortfall. |
| `high_demand`                    | Evening Peak Surge | Demand multiplier $\times 1.30$ across all sectors between 17:00 and 22:00.            | Tests BESS discharge ceiling ($25\text{ kW}$) and evening load curtailment.                                                                                                                                                                                                                                                       |
| `battery_constraint`             | Degraded Battery   | Battery capacity halved to $60\text{ kWh}$, initial SoC $30\%$.                        | Rapid depletion to reserve threshold; forces daytime solar direct-consumption prioritization.                                                                                                                                                                                                                                     |
| `essential_stress`               | Severe Storm Shock | Solar reduced by $60\%$ ($\times 0.40$) for 4 hours (11:00–15:00), initial SoC $25\%$. | Severe stress test demonstrating resilience limits under prolonged cyclone/monsoon conditions.                                                                                                                                                                                                                                    |

---

## 7. Explicit Technical Simplifications (Out of Scope)

To maintain real-time responsiveness (<5 ms simulation cycle) and accessibility for decision-makers:

1. **No AC Power Flow or Reactive Power**: Voltage drops ($V$), reactive power ($Q$ in $\text{kVAR}$), power factor ($\cos \varphi$), and phase angle imbalances are not computed.
2. **Frequency Stability & Inverter Dynamics**: Transient grid stability, synthetic inertia, and harmonic distortion are outside this high-level energy balance model.
3. **Electrochemical Aging**: Battery calendar aging, cycle degradation mechanisms, and ambient temperature degradation curves are omitted.
4. **Autonomous Hardware SCADA Actuation**: The AI Copilot operates strictly in advisory mode. It generates verifiable mathematical proposals for human operators, never executing raw SCADA hardware writes without human confirmation.
