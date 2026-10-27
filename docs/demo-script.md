# 3-Minute Demo Video Script — Mitsinjo Grid

> **Target Duration**: Exactly 3 minutes (180 seconds).  
> **Key Hackathon Narrative**: How AI-assisted decision support protects vital life-saving infrastructure in an off-grid solar microgrid during unpredictable weather shocks.  
> **Canonical Demo Path**: `Solar Drop Event` → `Strategy Comparison` → `AI Copilot Explanation` → `Computed Evidence in 2D & 3D`.

---

## Timing Breakdown

```text
┌─────────────────┬─────────────────────────────────────────────────────────────┐
│ 00:00 – 00:30   │ Hook & Context: The Rural Energy Access Problem in Madagascar │
├─────────────────┼─────────────────────────────────────────────────────────────┤
│ 00:30 – 01:10   │ The Crisis: Simulating the "Cloudy Afternoon" Solar Drop   │
├─────────────────┼─────────────────────────────────────────────────────────────┤
│ 01:10 – 01:50   │ Strategy Lab: Proportional vs. Essential-First Allocation   │
├─────────────────┼─────────────────────────────────────────────────────────────┤
│ 01:50 – 02:35   │ Meta AI Copilot: Reasoning, Tool Execution & Proposals     │
├─────────────────┼─────────────────────────────────────────────────────────────┤
│ 02:35 – 03:00   │ 3D Digital Twin, Multi-language (EN/FR/MG) & Closing Impact │
└─────────────────┴─────────────────────────────────────────────────────────────┘
```

---

## Detailed Step-by-Step Script

### [00:00 – 00:30] Introduction: The Off-Grid Energy Dilemma

- **Visual**: Start on `/overview` (desktop viewport, English). Camera shows the sleek Dark Tech theme, live summary cards, and the glowing 24h battery/solar graph. Point out the clear `SIMULATED DATA` disclosure badge.
- **Narration**:
  > _"Across rural Madagascar and sub-Saharan Africa, thousands of off-grid communities rely entirely on solar microgrids with battery storage. In these villages, electricity isn't just about convenience—it powers the health clinic's vaccine refrigeration cold chain, water pumping, and community livelihoods._  
  > _But when unexpected weather hits and battery reserves run low, how does an operator decide who stays powered and who gets shed? Meet Mitsinjo Grid—an AI-powered copilot and digital twin designed to protect critical lifelines through deterministic math and transparent AI reasoning."_

---

### [00:30 – 01:10] The Crisis: Cloudy Afternoon Solar Drop

- **Action**:
  1. Click **Scenarios** in navigation (`/scenarios`).
  2. Select the **Cloudy Afternoon (-40%)** scenario card.
  3. Click **Open scenario Cloudy Afternoon** to jump to `/simulation`.
  4. Click **Run Simulation**.
- **Visual**:
  - The 24-hour simulation executes in under 5 ms.
  - The solar generation curve shows a sudden 40% dip at 13:00.
  - The battery SoC drains through the evening and reaches its 20% reserve at 23:00.
  - The impact banner flags a critical shortfall, a partial clinic/household deficit and the reserve reached at 23:00.
- **Narration**:
  > _"Under normal sunlight, our 40 kilowatt-peak solar array powers all 5 village sectors and charges our 120 kilowatt-hour battery. But let's trigger a realistic shock: a two-hour monsoon cloud cover at 1 PM with low initial battery reserves._  
  > _Instantly, our pure TypeScript engine calculates all 24 hours. The battery drains through the evening peak and hits its 20% safety reserve at 11 PM, leaving the village short of power that hour."_

---

### [01:10 – 01:50] Strategy Lab: Proportional vs. Essential-First

- **Action**:
  1. Click **Strategy Lab** in navigation (`/strategies`).
  2. Click **Compare Strategies**.
- **Visual**:
  - Side-by-side comparison between **Proportional Allocation** and **Essential-First Priority**.
  - Under `Proportional`: essential coverage below 100% (≈ 99.4%) — the clinic misses ≈ 0.2 kWh of its essential need at 23:00.
  - Under `Essential-First`: 100% essential coverage (0 kWh critical unmet); households absorb the shortfall instead.
  - Decision Summary card highlights the trade-off.
- **Narration**:
  > _"Most automated microgrid controllers use naive proportional load shedding—reducing power equally across all circuits. Here in the Strategy Lab, we see the danger: proportional shedding cuts the health clinic below its essential need—even a small gap at night can threaten the vaccine cold chain!_  
  > _Switching to our Essential-First algorithm guarantees 100% power to the clinic by shedding household circuits first. The engine verifies zero energy balance violations."_

---

### [01:50 – 02:35] Meta AI Copilot: Reasoning & Tool Calling

- **Action**:
  1. Click **AI Copilot** in navigation (`/copilot`).
  2. Click the suggested prompt button:  
     `"Why is the clinic receiving less energy?"`
  3. Watch the assistant response stream in via Server-Sent Events (SSE).
  4. Point out the structured sections:
     - **What happened**
     - **Computed evidence** (with verifiable simulation hash and metrics)
     - **Why it matters**
     - **Explore next**
  5. The Copilot outputs an interactive Proposal Card:  
     `Switch strategy to essential_first`.
  6. Review the inline proposal card (current → proposed diff) → Click **Approve & Apply Scenario**.
- **Narration**:
  > _"For an operator in the field, raw telemetry can be overwhelming. This is where our Meta AI Copilot steps in._  
  > _We ask: 'Why is the clinic receiving less energy?'_  
  > _Notice: the AI doesn't guess or hallucinate numbers. It uses OpenAI-compatible tool calling to query our engine via `get_grid_state` and `compare_strategies`._  
  > _It returns a rigorous, structured diagnosis grounded in computed evidence—citing the exact simulation run ID, the 20% battery reserve trigger, and offering an actionable proposal card to switch to Essential-First. With one click, the operator applies the strategy across the entire system."_

---

### [02:35 – 03:00] 3D Digital Twin, Localization & Closing

- **Action**:
  1. Return to `/simulation` or `/overview`.
  2. Orbit and zoom into the **3D Microgrid Digital Twin** (React Three Fiber).
  3. Show the animated glowing power lines flowing from the Solar Array and BESS to the Health Clinic, Water Pump, and School.
  4. Toggle language dropdown from `EN` to `FR` (Français) and then `MG` (Malagasy) to show complete translation key parity.
- **Visual**:
  - 3D buildings pulse with energy status; transmission lines pulse with current.
  - UI labels fluidly update across all languages without static text.
- **Narration**:
  > _"Every watt is reflected in our 3D digital twin—giving local operators an intuitive spatial view of energy distribution._  
  > _And because energy access is local, Mitsinjo Grid is fully multilingual—with 100% key parity in English, French, and native Malagasy._  
  > _100% deterministic TypeScript engine. Transparent Meta AI reasoning. 242 automated tests. Mitsinjo Grid bridges the gap between frontier AI and community resilience."_

---

## Demo Checklist Before Recording

- [ ] Clean browser window at 1440 × 900 resolution.
- [ ] Dev server running (`make dev` or production URL `https://mitsinjo-grid.vercel.app`).
- [ ] Audio input checked with clean noise suppression.
- [ ] Language set to English default.
- [ ] Practice 1 dry-run to ensure pacing lands at 2:55 – 3:00.
