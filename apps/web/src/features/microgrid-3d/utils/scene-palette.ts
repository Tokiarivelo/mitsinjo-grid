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
 */
export const WINDOW_GLOW_BY_STATUS: Record<BuildingStatus, number> = {
  full: 1,
  partial: 0.45,
  unserved: 0,
  unknown: 0.35,
  disconnected: 0,
};

/** Tailwind text class per status, for 2D diagram wires (SVG uses `currentColor`). */
export const STATUS_TEXT_CLASS: Record<StatusColor, string> = {
  'battery-green': 'text-battery-green',
  'warning-amber': 'text-warning-amber',
  'critical-red': 'text-critical-red',
  idle: 'text-text-muted',
};
