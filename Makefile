# Mitsinjo Grid — useful commands. `make` or `make help` lists them.
# Rule: every new useful command gets a target here with a `## description` (see .claude/rules/maintenance.md).

SHELL := /bin/bash
.DEFAULT_GOAL := help
PNPM   ?= pnpm
WEB    := web
ENGINE := @mitsinjo/engine
URL    ?= http://localhost:3000
ROUTES := overview simulation strategies scenarios copilot
SHOTS  := design/shots

# Guard: pnpm targets need the workspace created in P1.
define need_ws
	@test -f package.json || { echo "No package.json yet — do P1 (docs/tasks/P1-repo.md) first."; exit 1; }
endef

##@ Help
help: ## Show this help
	@awk 'BEGIN{FS=":.*##"} /^##@/{printf "\n\033[1m%s\033[0m\n",substr($$0,5)} /^[a-zA-Z0-9_-]+:.*##/{printf "  \033[36m%-16s\033[0m %s\n",$$1,$$2}' $(MAKEFILE_LIST)

##@ Setup
install: ## Install all workspace dependencies
	$(need_ws)
	$(PNPM) install

env: ## Create apps/web/.env.local from .env.example (if missing)
	@test -f apps/web/.env.local && echo "apps/web/.env.local exists" || { cp .env.example apps/web/.env.local && echo "Created apps/web/.env.local"; }

setup-claude: ## Install Claude Code settings + format hook (human, once)
	cp docs/setup/claude-settings.json .claude/settings.json
	mkdir -p .claude/hooks && cp docs/setup/format.sh .claude/hooks/format.sh && chmod +x .claude/hooks/format.sh
	@echo "Restart claude to apply."

browsers: ## Install Playwright browsers (for e2e + screenshots)
	$(need_ws)
	$(PNPM) --filter $(WEB) exec playwright install chromium

##@ Develop
dev: ## Run the web app in dev mode (port 3000)
	$(need_ws)
	$(PNPM) dev

dev-mock: ## Run dev with the offline mock LLM provider
	$(need_ws)
	LLM_PROVIDER=mock $(PNPM) dev

build: ## Production build (all packages)
	$(need_ws)
	$(PNPM) build

start: build ## Build then serve the production app
	$(PNPM) --filter $(WEB) start

##@ Quality
test: ## Run all unit tests
	$(need_ws)
	$(PNPM) test

test-engine: ## Run engine tests only
	$(need_ws)
	$(PNPM) --filter $(ENGINE) test

test-web: ## Run web unit tests only
	$(need_ws)
	$(PNPM) --filter $(WEB) test

test-watch: ## Run engine tests in watch mode
	$(need_ws)
	$(PNPM) --filter $(ENGINE) exec vitest

coverage: ## Unit tests with coverage
	$(need_ws)
	$(PNPM) test -- --coverage

e2e: ## Playwright demo-path e2e (mock LLM)
	$(need_ws)
	LLM_PROVIDER=mock $(PNPM) --filter $(WEB) test:e2e

typecheck: ## TypeScript check (all packages)
	$(need_ws)
	$(PNPM) typecheck

lint: ## Lint all packages
	$(need_ws)
	$(PNPM) lint

format: ## Format with Prettier
	$(need_ws)
	$(PNPM) exec prettier --write .

check: typecheck lint test ## typecheck + lint + test (run before handoff)

ci: check e2e build ## Everything CI runs

##@ Design
shots: ## Screenshot all routes at 1440x900 into design/shots/ (dev server must run)
	$(need_ws)
	@mkdir -p $(SHOTS)
	@for r in $(ROUTES); do \
	  $(PNPM) --filter $(WEB) exec playwright screenshot --viewport-size=1440,900 $(URL)/$$r $(CURDIR)/$(SHOTS)/$$r.png >/dev/null && echo "✓ $(SHOTS)/$$r.png"; \
	done

mockups: ## List Stitch mockup exports and their map status
	@ls -1 design/stitch/*.png 2>/dev/null || echo "No exports in design/stitch/"
	@grep -E '^\| (Live|Overview|Strategy|AI|Scenarios)' docs/design/stitch-map.md | awk -F'|' '{printf "  %-16s %s\n",$$2,$$7}'

##@ Performance
analyze: ## Bundle analysis build (needs @next/bundle-analyzer)
	$(need_ws)
	ANALYZE=true $(PNPM) --filter $(WEB) build

lighthouse: ## Lighthouse perf score for /overview (prod server must run)
	npx -y lighthouse $(URL)/overview --preset=desktop --only-categories=performance --quiet --output=json \
	  | jq '{score: .categories.performance.score, lcp: .audits["largest-contentful-paint"].displayValue, tbt: .audits["total-blocking-time"].displayValue}'

##@ Agents & tooling
claude: ## Start Claude Code with root .env exported (STITCH_API_KEY for Stitch MCP)
	@test -f .env || { echo "No .env — cp .env.example .env and fill it."; exit 1; }
	@source scripts/env.sh && exec claude

env-export: ## Print .env as export lines — use: eval "$$(make -s env-export)"
	@bash scripts/env.sh --print

mcp: ## List MCP servers (checks Stitch connection)
	claude mcp list

status: ## Show current phase/next task from HANDOFF.md
	@sed -n '/^## State/,/^## Decisions/p' HANDOFF.md | sed '$$d'

todo: ## List unchecked tasks across all phases
	@grep -n -- '- \[ \]' docs/tasks/P*.md | sed 's/:- \[ \] / /' | cut -c1-140

##@ Deploy
deploy-preview: ## Deploy a preview to Vercel
	npx -y vercel

deploy: ## Deploy to production on Vercel
	npx -y vercel --prod

##@ Cleanup
clean: ## Remove build/test output (keeps node_modules)
	rm -rf apps/*/.next apps/*/out packages/*/dist .turbo apps/*/.turbo packages/*/.turbo coverage apps/*/coverage packages/*/coverage apps/*/playwright-report apps/*/test-results $(SHOTS)

clean-all: clean ## Also remove node_modules
	rm -rf node_modules apps/*/node_modules packages/*/node_modules

.PHONY: help install env setup-claude browsers dev dev-mock build start test test-engine test-web test-watch coverage e2e \
        typecheck lint format check ci shots mockups analyze lighthouse claude env-export mcp status todo deploy-preview deploy clean clean-all
