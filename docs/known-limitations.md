# Known Limitations

This document outlines the current known limitations of the Mitsinjo Grid simulation platform as of Phase 8.

## 1. Simulation Horizon & Granularity
- **24-Hour Discrete Horizon**: The engine simulates a 24-hour cycle at 1-hour time-steps ($t \in [0, 23]$).
- **No Continuous Multi-Day Roll-Over**: Weather variations (e.g. consecutive cloudy days, seasonal monsoon) are evaluated through discrete scenario inputs rather than continuous multi-day state progression.

## 2. Physical & Electrical Modeling
- **Simplified Battery Degradation**: Battery State of Charge (SoC), charge/discharge efficiency, and minimum/maximum constraints ($SoC \in [0.10, 0.95]$) are modeled deterministically. Long-term cycle degradation, thermal derating, and cell balancing dynamics are abstracted.
- **Single-Phase Balance**: Grid power flows represent aggregate real power ($kW$). Reactive power ($kVAR$), power factor, voltage sag, frequency regulation, and three-phase unbalances are not modeled.
- **Inverter Efficiency Curve**: Inverter efficiency is modeled with a fixed baseline efficiency coefficient rather than a load-dependent non-linear efficiency curve.

## 3. WebGL & Hardware Acceleration
- **Headless & Software Rendering in CI**: In CI environments lacking hardware GPU acceleration (e.g., GitHub Actions, SwiftShader software rasterizer), 3D framerates will drop below the 45 fps target (~15–20 fps). However, draw call count ($\le 97$ vs 150 budget) and triangle count ($\approx 6,248$ vs 150,000 budget) remain strictly within budget.
- **Integrated GPU Target**: Hardware acceleration with WebGL 2.0 support is recommended for full 60 fps fluid rendering of the 3D village digital twin.

## 4. Main-Thread Simulation Execution
- **Synchronous Engine**: The deterministic engine executes in $\approx 1.8$ to $2.2\text{ ms}$ on the main JavaScript thread, comfortably below the $10\text{ ms}$ budget and $16\text{ ms}$ frame budget. If sub-minute time-steps or Monte Carlo iterations are introduced in future releases, engine computation should be offloaded to a Web Worker.

## 5. AI Copilot & Provider Integrations
- **Mock Mode by Default**: For offline development, zero-credential CI, and deterministic testing, `LLM_PROVIDER=mock` provides instantaneous synthetic analysis.
- **Meta Llama Integration**: In production (`LLM_PROVIDER=meta`), the copilot communicates with Meta Llama models via OpenAI-compatible Server-Sent Events. API latency and rate limits are subject to the upstream provider.

## 6. Synthetic Village Data Notice
- All solar profiles, load curves, and village node properties are synthetic archetypes inspired by rural Madagascar off-grid electrification scenarios. They are intended for decision support, trade-off exploration, and education, not direct industrial SCADA or PLC actuation.
