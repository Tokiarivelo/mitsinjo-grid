# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-28 · **By:** Claude Code (PR #17 review) + Antigravity (theme/mobile) · **Branch:** `feat/3d-fidelity`

## State

- PR #17 (3D fidelity + /simulation & /overview redesign) reviewed, fixed, merged into `main`.
- Energy flow is explicit in every view, all driven by `toSceneModel` (no new numbers):
  - 3D: powered cables = lit core + glowing electron dots (`ui/electron-flow.tsx`, 1 InstancedMesh); cut cables dark.
  - 2D `GridDiagram` (`features/microgrid-3d`): Topology (village plan) and Circuit (single-line, breakers open
    when a sector is cut). Moving electrons on powered wires, red dashes + break mark on cut ones, legend.
  - Labels have reserved boxes (`utils/diagram-layout.ts`); tests assert no overlap and no wire under a label.
- Light theme (`lib/theme.tsx`, `ThemeSwitcher`) and mobile layout (`MobileNav`, responsive 3D viewport).
- Checks green: typecheck, lint, 99 engine tests, 228+ web tests, i18n parity.

## Next task

- `make e2e` + `make shots` on the merged main (light theme + new diagrams), then next unchecked task (`make todo`).

## Decisions taken

- Hub→bus feeder now carries engine `step.servedKw`, always toward the bus (was "backward" when discharging,
  which drew current flowing from the village into the battery).
- 2D labels are an HTML overlay sized in container units (`cqw`), not `foreignObject` (Chrome repaint bug on scroll).
- Shared UI extracted: `SectorIcon` (was copied in 5 files), `ViewModeToggle`; `EnergyBar empty` before a run
  (overview used to show "Essential service shortfall" before any simulation).
- E2E fix: header Run button on /simulation (hidden while Controls tab shows its own); no-GPU devices start
  on `low` with frozen electrons; camera snaps on mount; fps probe capped at 8 s (`docs/performance.md`).
- CSS custom properties in `:root`/`html.light` power Tailwind `@theme` so opacity utilities work in both themes.

## Open questions / blockers

- Overview copy `sheddingProtocolDesc` ("below 20%") and the two different site coordinates are static claims,
  not engine output; confirm or remove.

## Files touched this session

- 3D/2D: `features/microgrid-3d/{ui/electron-flow,ui/flow-wire,ui/grid-diagram,utils/flow-path,utils/diagram-layout}`
- Reuse: `components/ui/{sector-icon,view-mode-toggle,energy-bar}`; viewport, overview, inspectors use them.
- Theme/mobile: `lib/theme.tsx`, `app/{globals.css,layout.tsx}`, `components/layout/*`, `components/ui/theme-switcher`
- Docs: `docs/design/{3d-scene,components,tokens}.md`, `docs/design/screens/{live-simulation,overview}.md`
