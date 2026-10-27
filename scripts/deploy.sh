#!/usr/bin/env bash
# Production deploy to Vercel — only from a clean `main` that matches origin/main.
# Pushes to `main` already deploy through the Vercel Git integration; use this as a manual fallback.
set -euo pipefail

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "main" ]]; then
  echo "Refusing to deploy: on '$branch'. Only 'main' is deployed." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Refusing to deploy: working tree has uncommitted changes." >&2
  exit 1
fi

git fetch -q origin main
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
  echo "Refusing to deploy: local main differs from origin/main (pull or push first)." >&2
  exit 1
fi

npx -y vercel@latest deploy --prod
