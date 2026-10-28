# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-28 · **By:** Antigravity (Neon DB Live Verified, Cloudflare R2 Guide) · **Branch:** `feat/simulation-weather-workflow`

## State

- Neon PostgreSQL live connection **fully tested and verified** (`ep-hidden-king-b8d7t7ix-pooler.c-14.us-east-1.aws.neon.tech`).
- Serverless driver adapter configured in `apps/web/src/server/db/neon.ts` with IPv4 HTTPS fetch fallback (eliminates IPv6 ENETUNREACH in dual-stack environments).
- Neon DB tables `copilot_sessions` and `copilot_messages` automatically created and operational on user's live Neon DB; sessions CRUD API verified (`/api/copilot/sessions`).
- Detailed French guide created for Cloudflare R2: `docs/setup/cloudflare-r2.md` explaining step-by-step account setup, bucket creation, public access URL, and S3 API credentials.
- `.env.example`, `docs/setup/README.md`, and `docs/copilot.md` updated with R2 variables and guide references.
- Full test suite: **50/50 test files passed (321/321 tests passing)**.
- Formatting: `make format-changed` cleanly passed.

## Next task

- Review and PR merge for `feat/simulation-weather-workflow`.
- Configure `R2_*` credentials from Cloudflare dashboard into `.env.local` to enable direct S3 presigned URL storage.

## Decisions taken

- `neonConfig.fetchFunction` configured to prioritize IPv4 family on Node server, avoiding node-fetch undici timeout on unreachable IPv6 gateways.
- Neon DB operations verified end-to-end with live SELECT, CREATE TABLE, session creation, and deletion.
- Comprehensive French guide covers exact Cloudflare UI screens, S3 credentials, and public r2.dev subdomain setup.

## Files touched this session

- DB: `apps/web/src/server/db/neon.ts`
- Guides & Docs: `docs/setup/cloudflare-r2.md`, `docs/setup/README.md`, `docs/copilot.md`, `.env.example`
- Tests: `apps/web/src/server/db/__tests__/neon.test.ts`
