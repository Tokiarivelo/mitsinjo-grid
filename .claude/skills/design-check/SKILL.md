---
name: design-check
description: Gate every frontend change through the design system and the Stitch mockup — load the screen spec + mockup before coding, and compare a screenshot of the implementation against the mockup after. Use for any work on a route, layout, component or the 3D scene.
---

**Before coding (gate in)**

1. Open `docs/design/stitch-map.md`; find the row for the surface you're touching.
2. Load its spec file (only that one) + `docs/design/tokens.md` only if new styling is needed.
3. Mockup:
   - Export exists in `design/stitch/<name>.png` → Read the PNG (look at it once; note layout, spacing, hierarchy).
   - Status `generated` but no export → via Stitch MCP, fetch that screen's image/HTML, save to `design/stitch/`, set status `exported`.
   - No mockup → build from the spec alone; add a note in stitch-map "built without mockup".
4. Use `.html` exports only to read exact spacing/structure — never paste Stitch HTML/CSS into the app; rebuild with our tokens + components.

**After coding (gate out)** 5. Start dev server if not running (`make dev-mock`); screenshot at 1440×900 (`make shots` does all routes → `design/shots/`), or one route:
`pnpm --filter web exec playwright screenshot --viewport-size=1440,900 http://localhost:3000/<route> /tmp/impl-<name>.png` 6. Read the screenshot next to the mockup. Check: layout zones & proportions, hierarchy, token colors (semantics),
typography roles, spacing rhythm, SIMULATED label, AI vs computed separation, states. 7. Fix mismatches that don't conflict with contracts/design rules; log intentional deviations in stitch-map Notes. 8. Set row status `checked`. Reply with ≤ 6 lines: matches, deviations, fixes.

Token tips: look at each image once per session; don't fetch from MCP what's already exported; compare one screen per run.
