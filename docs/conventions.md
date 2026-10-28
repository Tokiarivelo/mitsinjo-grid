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
- Multi-language (i18n) & Zero static text: Official package is `next-intl`. Zero static or hardcoded user-visible text in components or code. All strings must be extracted to `apps/web/src/messages/{en,fr,mg}.json` and consumed via `useTranslations(namespace)`. 100% key parity across `en`, `fr`, and `mg` is enforced and verified in PR validation and CI (`make check-i18n`).
- Styling & Theming: Tailwind tokens from `globals.css @theme` only; no raw hex or hardcoded colors in components. All components must support both Dark (default) and Light theme modes via CSS variables with WCAG AA contrast.
- Responsive Mobile: Every UI surface must adapt cleanly from 320px mobile viewports to large desktop screens. Grids reflow to single column, interactive elements have touch targets $\ge 44\text{px}$, no horizontal page overflow, and layouts provide `pb-20 md:pb-6` padding for the mobile bottom nav (`MobileNav`).
- Files: components `PascalCase.tsx`, hooks `useX.ts`, utils `kebab-case.ts`, tests `*.test.ts(x)`.

## Reuse (no duplication)

- Before writing code, search for what already exists (`rg`): engine helpers, `lib/format.ts`, `lib/utils.ts`,
  `components/ui`, feature `hooks/` and `utils/`, i18n keys (`common.*` first).
- Same logic, markup or copy in 2+ places → extract it once and reuse it. No copy-paste, even "just a few lines".
- Where reusable code lives:
  - engine math → `packages/engine/src/model` or the owning module, exported through `src/index.ts` if the web needs it;
  - pure web logic → feature `utils/` (one feature) or `apps/web/src/lib/` (shared);
  - React logic → feature `hooks/`; shared UI → `components/ui` or `components/layout`;
  - repeated text or formats (units, ranges) → one i18n key, usually in `common`.
- Write reusable units generic: typed params instead of hardcoded values, no hidden store or global access in `utils/`.
- Every extracted unit ships with its own test (same commit). Then delete the old copies.
- When you touch duplicated code, extract it in the same change instead of adding one more copy.

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
