# Tokens

Both Dark (default) and Light theme modes supported. Keep UI mostly neutral; energy colors guide attention.

## Neutral colors

| Token            | Dark Hex | Light Hex | Use                             |
| ---------------- | -------- | --------- | ------------------------------- |
| canvas           | #080D1A  | #F8FAFC   | App background                  |
| canvas-raised    | #0D1526  | #FFFFFF   | Secondary regions               |
| canvas-sunken    | #050811  | #F1F5F9   | Recessed slots & 3D backdrops   |
| surface          | #111D30  | #FFFFFF   | Cards, panels, sidebar          |
| surface-elevated | #17253A  | #F8FAFC   | Modals, dropdowns, raised cards |
| surface-hover    | #1C2D45  | #F1F5F9   | Hover                           |
| border           | #26364D  | #E2E8F0   | Separators, outlines            |
| border-strong    | #3B506B  | #CBD5E1   | Emphasis                        |
| text-primary     | #F4F7FB  | #0F172A   | Headings, values                |
| text-secondary   | #A8B6C9  | #475569   | Supporting text                 |
| text-muted       | #72839A  | #64748B   | Metadata, inactive              |

## Energy / semantic colors

| Token         | Dark Hex | Light Hex | Meaning                                      |
| ------------- | -------- | --------- | -------------------------------------------- |
| solar-amber   | #FFB547  | #D97706   | Solar production, sunlight, (primary button) |
| energy-cyan   | #50D8E8  | #0891B2   | Energy flow, connections, active nav edge    |
| network-blue  | #729CFF  | #2563EB   | Distribution network, secondary series       |
| battery-green | #53D6A0  | #059669   | Healthy battery, favorable outcome           |
| ai-violet     | #B6A0FF  | #7C3AED   | AI elements only                             |
| warning-amber | #FFCB70  | #D97706   | Shortage warning                             |
| critical-red  | #FF7185  | #DC2626   | Critical failure, unmet essential demand     |

Rules: amber = solar not decoration; cyan = flow; green only for healthy/favorable; violet AI only; red genuinely critical only; never color alone; no full-screen gradients.
Background: base canvas + soft amber radial glow behind solar, very faint cyan near battery/network. No rainbow gradients, no neon borders, minimal glassmorphism.

## Typography

- Display (Space Grotesk): titles, section headings, hero metrics. Wordmark medium weight.
- Sans (Inter): body, buttons, nav, tooltips, labels.
- Mono (IBM Plex Mono): readings, timestamps, IDs, percentages (`12.8 kWh`, `84%`, `SIM-0042`).

| Role                                                      | Size px | Weight |
| --------------------------------------------------------- | ------- | ------ |
| Page title                                                | 30-36   | 600    |
| Hero metric                                               | 32-44   | 600    |
| Section heading                                           | 18-22   | 600    |
| Card heading                                              | 14-16   | 600    |
| Body                                                      | 14      | 400    |
| Supporting                                                | 12-13   | 400    |
| Technical label                                           | 11-12   | 500    |
| Compact data                                              | 13-15   | 500    |
| Sentence case; uppercase only for small technical labels. |

## Spacing (4px base)

4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Content padding 24; card padding 18-24. No arbitrary values.

## Radii

Card 16; small control 8-10; modal 20.

## Layout dimensions

Sidebar 232; header 68; copilot 360 (340-380 adjustable); design viewport 1440. See shell.md.

## Motion (design targets)

- Small UI transitions 120-180ms; panel 180-260ms; camera short, interruptible.
- Energy-flow animation only while flow active; chart transitions subtle.
- Reduced motion: disable flow animation/camera tweens, use instant state change.

## Tailwind CSS v4

next/font variables to define on `<html>`: `--font-space-grotesk`, `--font-inter`, `--font-plex-mono`.

```css
@import 'tailwindcss';
@theme {
  --color-canvas: #080d1a;
  --color-canvas-raised: #0d1526;
  --color-surface: #111d30;
  --color-surface-elevated: #17253a;
  --color-surface-hover: #1c2d45;
  --color-border: #26364d;
  --color-border-strong: #3b506b;
  --color-text-primary: #f4f7fb;
  --color-text-secondary: #a8b6c9;
  --color-text-muted: #72839a;
  --color-solar-amber: #ffb547;
  --color-energy-cyan: #50d8e8;
  --color-network-blue: #729cff;
  --color-battery-green: #53d6a0;
  --color-ai-violet: #b6a0ff;
  --color-warning-amber: #ffcb70;
  --color-critical-red: #ff7185;

  --font-display: var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif;
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, monospace;

  --radius-card: 16px;
  --radius-control: 10px;
  --radius-control-sm: 8px;
  --radius-modal: 20px;

  --spacing-sidebar: 232px;
  --spacing-header: 68px;
  --spacing-copilot: 360px;

  --duration-fast: 150ms;
  --duration-panel: 220ms;
}
body {
  background: var(--color-canvas);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
}
```
