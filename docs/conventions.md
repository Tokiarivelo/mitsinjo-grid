# Conventions

## Code

- TS strict; no `any`, no unjustified `!`. Prefer `type` imports.
- Aliases: `@/` → `apps/web/src`, `@mitsinjo/engine` → package. Never deep-import engine internals.
- Pages: `export default function Page() { return <OverviewPage /> }` — nothing else.
- Feature slice: `ui/` (props in, JSX out) · `hooks/` (store + logic) · `utils/` (pure) · `__tests__/` · `index.ts`.
  Add `schemas/`, `consts/`, `types/` only when needed.
- Client components: `'use client'` only on leaf interactive components and hooks consumers.
- 3D: `features/microgrid-3d` loaded with `next/dynamic({ ssr:false })`; scene reads a memoized
  `SceneModel` built by `utils/toSceneModel(result, timeIndex)` (pure, tested).
- Formatting numbers: `lib/format.ts` (`fmtKw`, `fmtKwh`, `fmtPct`) — always with unit.
- Multi-language (i18n): `next-intl` is the official package; messages in `apps/web/src/messages/{en,fr,mg}.json`. Consume via `useTranslations(namespace)`. No hardcoded user-visible text.
- Styling: Tailwind tokens from `globals.css @theme` only; no raw hex in components.
- Files: components `PascalCase.tsx`, hooks `useX.ts`, utils `kebab-case.ts`, tests `*.test.ts(x)`.

## Tests

- Engine: Vitest, ≥ 90 % lines. Web: Vitest + Testing Library for hooks/interactive UI.
- E2E: one Playwright spec `e2e/demo-path.spec.ts` (load → cloudy scenario → run → compare → ask copilot (mock)).
- `LLM_PROVIDER=mock` in all tests. No network in unit tests.

## Git

- Conventional commits, scope = `engine|web|sim|3d|lab|copilot|design|docs|ci`.
- One task id per commit when possible: `feat(engine): essential_first strategy [P3-T4]`.
- Never commit `.env*` except `.env.example`.

## Agent hygiene (token cost)

- Start with `/start`, end with `/handoff`, check with `/verify` (affected packages only, `tail -40`).
- Use the domain skill (`/engine-change`, `/ui-feature`, `/copilot-tool`, `/scene-3d`) instead of loading many docs.
- Delegate independent units with `/design-dispatch`-style briefs: paths only, ≤ 10-line replies.
- Start a fresh session per task ID rather than one long session; HANDOFF carries the state.
- Read `HANDOFF.md` + one task file; load other docs only if listed.
- Don't paste large files into context; use `rg -n` and read ranges.
- Don't re-read files you just wrote. Don't regenerate unchanged files.
- Keep docs DRY: link to `contracts.md` instead of copying types.
- Update `HANDOFF.md` by overwriting; ≤ 40 lines.
