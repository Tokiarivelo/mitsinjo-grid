import type { BatteryStatusColor, StatusColor } from '../types';

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
};
