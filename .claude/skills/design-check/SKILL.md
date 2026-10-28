---
name: design-check
description: Gate every frontend change through the design system and the Stitch mockup — load the screen spec + mockup before coding, and verify responsiveness (desktop & mobile) and theming (dark & light) against the mockup after. Use for any work on a route, layout, component or the 3D scene.
---

**Before coding (gate in)**

1. Open `docs/design/stitch-map.md`; find the row for the surface you're touching.
2. Load its spec file (only that one) + `docs/design/tokens.md` only if new styling is needed.
3. Mockup:
   - Export exists in `design/stitch/<name>.png` → Read the PNG (look at it once; note layout, spacing, hierarchy).
   - Status `generated` but no export → via Stitch MCP, fetch that screen's image/HTML, save to `design/stitch/`, set status `exported`.
   - No mockup → build from the spec alone; add a note in stitch-map "built without mockup".
4. Use `.html` exports only to read exact spacing/structure — never paste Stitch HTML/CSS into the app; rebuild with our tokens + components.

**After coding (gate out)**

5. Start dev server if not running (`make dev-mock`); screenshot desktop (1440×900) and mobile (390×844):
   - Desktop: `pnpm --filter web exec playwright screenshot --viewport-size=1440,900 http://localhost:3000/<route> /tmp/impl-<name>-desktop.png`
   - Mobile: `pnpm --filter web exec playwright screenshot --viewport-size=390,844 http://localhost:3000/<route> /tmp/impl-<name>-mobile.png`
   - All routes: `make shots` (outputs to `design/shots/`).
6. Inspect the screenshot against the mockup:
   - **Hierarchy & Proportions:** Layout zones, spacing rhythm, typography roles, SIMULATED label, AI vs computed separation, states.
   - **Responsive Mobile:** Viewport reflows to single column on mobile (320px–768px), zero horizontal overflow, touch targets $\ge 44\text{px}$, mobile bottom navigation visible with padding (`pb-20 md:pb-6`).
   - **Dual Theming:** Verifiable in both Dark and Light theme modes. All colors come from `@theme` semantic tokens, zero raw hex, WCAG AA contrast compliant.
7. Fix mismatches that don't conflict with contracts/design rules; log intentional deviations in stitch-map Notes.
8. Set row status `checked`. Reply with ≤ 6 lines: matches, deviations, fixes.

Token tips: look at each image once per session; don't fetch from MCP what's already exported; compare one screen per run.
