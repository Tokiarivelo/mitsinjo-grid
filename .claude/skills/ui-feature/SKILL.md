---
name: ui-feature
description: Build or change a screen, panel or shared component in apps/web following the feature-slice pattern and the design system. Use for any UI work outside the 3D scene.
---

Load only: `docs/design/screens/<route>.md` or `docs/design/components.md` (the needed section), plus `docs/design/tokens.md` if styling something new.

0. **Gate in:** run `/design-check` steps 1–4 (spec + mockup). No mockup → note it in stitch-map.
1. Place code: route page → `app/(lab)/<route>/page.tsx` (import only); screen → `features/<feature>/ui/<Name>Page.tsx`; logic → `hooks/useX.ts`; pure helpers → `utils/`; shared → `components/{ui,layout,charts}`.
2. Check `components/ui` first; reuse before creating. Variants via `cva`.
3. Data: hook reads store with narrow selectors; UI receives formatted props. No engine calls in `ui/`.
4. States: empty / error / modified per `docs/design/states-copy.md`. SIMULATED label present.
5. A11y: roles, labels, focus-visible, keyboard path.
6. Tests: hook test + interactive component test in `__tests__/`. Export from feature `index.ts`.
7. `/verify web`, then **gate out:** `/design-check` steps 5–8.
