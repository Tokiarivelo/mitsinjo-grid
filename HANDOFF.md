# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-03 (P9-T7 submission readiness) · **By:** Claude Code · **Branch:** feat/submission-readiness

## Current state

- Branch `feat/submission-readiness` from `origin/main` (`a558cef`). PR #49 (`feat/pi-0-placed-model`) is separate, not merged here.
- Done against the community checklist (artifacts.watt-mind.com/meta-hackathon-2026/checklist), video excluded:
  - README top: provenance (built from scratch from Oct 26), track (Build for Your World, Indie), bonus targets
    (Best Agentic, Best Creative), "not a 1-prompt wrapper" paragraph, Meta models table (Spark, SAM 3.1, Muse Image,
    Muse Wonder, Muse Voice, optional Glimmer). Quickstart gained Docker Compose + Benchmarks sections.
  - `benchmarks/` (README + `engine.json`) from `make bench` (`packages/engine/src/__tests__/benchmark.test.ts`).
  - `Dockerfile` + `compose.yaml` + `.dockerignore`: `docker compose up -d --build` / `make docker-up|docker-down|docker-logs`
    (keyless mock without `.env`; healthcheck on `/overview`; verified healthy).
  - GitHub repo homepage set to `https://mitsinjo-grid.vercel.app` (same as README; `-fqfg` is the auto alias).

## Next

- P9-T5 (human): record the 3-min video (provenance line in first 10 s, live Meta calls on screen, 2+ metrics
  before 2:55, e.g. `benchmarks/README.md` clinic 71.9 → 75.5 %); put the link in README line 15.
- P9-T6 (human): submit before Wed Nov 4 21:00 EST; no pushes after the freeze.
- Not done (out of reach): partner inference / fine-tuned open weights / HF publish (Open Weight bonus).

## Files touched (this session)

`README.md`, `apps/web/README.md`, `Dockerfile`, `compose.yaml`, `.dockerignore`, `Makefile`, `.env.example`, `benchmarks/{README.md,engine.json}`,
`packages/engine/src/__tests__/benchmark.test.ts`, `docs/performance.md`, `docs/tasks/P9-ship.md`, `HANDOFF.md`.

## Decisions

- Benchmark asserts the health clinic is never served worse by essential-first than proportional. It does **not**
  assert all critical loads: under `essential_stress` essential-first covers critical loads 73.3 % vs 73.7 %
  (proportional) — reported as a trade-off in `benchmarks/README.md`, not hidden.
- Docker image is single-stage-on-deps (≈1.2 GB) for simplicity; `next start`, port forced to 3000.
