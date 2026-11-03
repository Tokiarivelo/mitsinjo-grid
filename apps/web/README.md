# Mitsinjo Grid — web app

Next.js 15 app of the Mitsinjo Grid workspace. Full documentation, features and setup: [root README](../../README.md).

## Run

From the repo root:

```bash
docker compose up -d --build   # or: make docker-up → http://localhost:3000 (offline mock copilot without .env)
docker compose down            # or: make docker-down

make install && make dev-mock  # without Docker: dev server on http://localhost:$PORT (default 3000), offline LLM
make dev                       # live Meta models (keys in .env, see .env.example)
```

Every energy number shown comes from `@mitsinjo/engine` (simulated data); the copilot only explains engine results.
