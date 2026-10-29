import type { BatteryStatusColor, BuildingStatus, StatusColor } from '../types';

/**
 * Three.js materials can't read Tailwind classes, so status colors mirror the
 * `@theme` tokens in `app/globals.css`. Keep both in sync.
 */
export const TOKEN_HEX = {
  solarAmber: '#ffb547',
  energyCyan: '#50d8e8',
  batteryGreen: '#53d6a0',
  warningAmber: '#ffcb70',
  criticalRed: '#ff7185',
  idle: '#64748b',
} as const;

export const STATUS_HEX: Record<StatusColor, string> = {
  'battery-green': TOKEN_HEX.batteryGreen,
  'warning-amber': TOKEN_HEX.warningAmber,
  'critical-red': TOKEN_HEX.criticalRed,
  idle: TOKEN_HEX.idle,
};

export const BATTERY_STATUS_HEX: Record<BatteryStatusColor, string> = {
  healthy: TOKEN_HEX.batteryGreen,
  warning: TOKEN_HEX.warningAmber,
  critical: TOKEN_HEX.criticalRed,
};

/** Tailwind border class per status, for HTML chips inside the scene and diagrams. */
export const STATUS_BORDER_CLASS: Record<StatusColor, string> = {
  'battery-green': 'border-battery-green/60',
  'warning-amber': 'border-warning-amber/70',
  'critical-red': 'border-critical-red/70',
  idle: 'border-border',
};

/** Tailwind background class per status, for HTML badges inside the scene. */
export const STATUS_BG_CLASS: Record<StatusColor, string> = {
  'battery-green': 'bg-battery-green',
  'warning-amber': 'bg-warning-amber',
  'critical-red': 'bg-critical-red',
  idle: 'bg-text-muted',
};

export const BATTERY_STATUS_BG_CLASS: Record<BatteryStatusColor, string> = {
  healthy: 'bg-battery-green',
  warning: 'bg-warning-amber',
  critical: 'bg-critical-red',
};

/**
 * Interior light per building status: served buildings glow, partially served flicker
 * at half, unserved go dark (reads as "lights out" without opening a panel).
 * @deprecated Prefer `glowFromIntensity(intensity)` (PL-T9) for continuous lighting.
 */
export const WINDOW_GLOW_BY_STATUS: Record<BuildingStatus, number> = {
  full: 1,
  partial: 0.45,
  unserved: 0,
  unknown: 0.35,
  disconnected: 0,
};

/**
 * Continuous window and street lamp glow from feeder intensity (PL-T9):
 * 0 → dark (no current served or no load),
 * lifeline floor (~0.1–0.25) → faint warm glow (a single incandescent lightbulb),
 * 1 → full radiant light.
 */
export function glowFromIntensity(intensity: number): number {
  if (!Number.isFinite(intensity) || intensity <= 0) return 0;
  const clamped = Math.min(1, intensity);
  return Math.min(1, Math.max(0, 0.18 + 0.82 * Math.pow(clamped, 0.85)));
}

/** Tailwind text class per status, for 2D diagram wires (SVG uses `currentColor`). */
export const STATUS_TEXT_CLASS: Record<StatusColor, string> = {
  'battery-green': 'text-battery-green',
  'warning-amber': 'text-warning-amber',
  'critical-red': 'text-critical-red',
  idle: 'text-text-muted',
};
