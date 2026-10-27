# Mitsinjo Grid — Rural Solar Microgrid Simulation & AI Decision Support

> **⚠️ SIMULATED DATA NOTICE**: All energy metrics, solar generation profiles, battery state-of-charge figures, and load balances presented in this system are synthetic and generated for simulation, educational, and decision-support purposes. They do not represent real-time measurements from physical microgrid hardware.

Mitsinjo Grid is an interactive microgrid simulator and AI-assisted decision-support platform designed for rural village electrification (inspired by rural off-grid contexts in Madagascar). It models 24-hour solar generation, battery energy storage systems (BESS), and essential vs. non-essential load distribution across 7 village infrastructure nodes (Solar Array, BESS, Health Clinic, Water Pump, School, Residential Households, and Local Market).

---

## Architecture

- **`apps/web`**: Next.js 15 App Router web application featuring Tailwind CSS, React Three Fiber (3D village digital twin), Recharts analytics, and SSE AI Copilot interface.
- **`packages/engine`**: Isolated pure TypeScript simulation engine (`@mitsinjo/engine`) running identical deterministic math on both client and server with Zod schema validation.

---

## Getting Started

### Prerequisites

- Node.js >= 20.x
- pnpm >= 9.x / 10.x

### Commands

```bash
# Install all dependencies across workspace
make install

# Start development server on http://localhost:3000
make dev

# Run unit tests across engine and web apps
make test

# Run TypeScript typechecks
make typecheck

# Full CI validation (typecheck + test + build)
make check
```

### Deployment (Vercel)

Only `main` is deployed. Merging into `main` deploys to production automatically; other branches and PRs are not deployed.

```bash
make deploy-link   # once per machine: link this clone to the Vercel project
make deploy        # manual production deploy (only from a clean, up-to-date main)
```

Production env vars are set in Vercel (Project → Settings → Environment Variables): `LLM_PROVIDER` (`mock` today),
plus `META_API_KEY`, `META_MODEL`, `META_BASE_URL` when switching to `meta`.

---

## Known Limitations

See [docs/known-limitations.md](docs/known-limitations.md) for full architectural boundaries and assumptions:
- **Simulation Horizon**: Discrete 24-hour cycle at 1-hour resolution ($t \in [0, 23]$).
- **Physical Modeling**: Deterministic battery SoC and aggregate real-power balance; degradation, inverter losses and reactive power are not modeled.
- **Headless WebGL in CI**: Headless Linux CI renders 3D scenes via software rasterizer (SwiftShader); hardware GPU is recommended for 60 fps client rendering.
- **Decision Support Archetypes**: All village load and solar models are synthetic archetypes for trade-off evaluation rather than direct SCADA control.

---

## License

This project is licensed under the [MIT License](LICENSE).
