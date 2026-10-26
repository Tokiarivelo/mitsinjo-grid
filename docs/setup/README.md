# Claude Code setup (install once, by a human)

Agents may not edit their own settings, so install these yourself after reviewing them:

```bash
cp docs/setup/claude-settings.json .claude/settings.json
mkdir -p .claude/hooks && cp docs/setup/format.sh .claude/hooks/format.sh && chmod +x .claude/hooks/format.sh
```

| Piece                   | Effect on tokens / speed                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `permissions.allow`     | Test, lint, `rg` and `git` read commands run without a prompt, so there's no waiting for approval             |
| `permissions.deny` Read | Blocks reading lockfile, `.next`, `node_modules`, reports and secrets, which are big files that waste context |
| `format.sh` hook        | Prettier runs after every edit with no output, so agents never spend turns on formatting                      |

Already active without install: `.claude/rules/*` (load only for matching paths) and `.claude/skills/*`.

## Stitch MCP (Google Stitch → mockups for agents)

`.mcp.json` (committed, no secret) registers the official remote server `https://stitch.googleapis.com/mcp`
and reads the key from `STITCH_API_KEY`.

1. stitch.withgoogle.com → profile → **Stitch settings** → **API key** → Create key (shown once; save it).
2. Put it in the gitignored root `.env` (`cp .env.example .env`, fill `STITCH_API_KEY=`), then start Claude
   Code with `make claude` (exports `.env`, then runs `claude`). To export it in the current terminal instead:
   `source scripts/env.sh` or `eval "$(make -s env-export)"`, then `claude`. Or put `export STITCH_API_KEY=...`
   in your shell profile.
   MCP servers read env vars only at startup, so restart after changing the key.
3. In Claude Code: `/mcp` → approve the project server `stitch` → ask "list my Stitch projects".
4. Generate screens with `docs/design/stitch-prompts.md`, then export each to `design/stitch/<name>.png`
   and fill ids in `docs/design/stitch-map.md`.

If Claude Code tries OAuth and fails ("does not support dynamic client registration"), it is a known
client issue with header-auth servers: update Claude Code, or use the community wrapper instead:
`claude mcp add -s project -e GOOGLE_CLOUD_PROJECT=<id> stitch -- npx -y stitch-mcp-auto`.
