import { Cloud, CloudLightning, CloudRain, CloudSun, Sun, type LucideIcon } from 'lucide-react';
import type { WeatherId } from '@mitsinjo/engine';

export interface WeatherVisual {
  icon: LucideIcon;
  /** Token classes for the icon tint (both themes). */
  tone: string;
}

export const WEATHER_VISUALS: Record<WeatherId, WeatherVisual> = {
  sunny: { icon: Sun, tone: 'text-solar-amber' },
  partly_cloudy: { icon: CloudSun, tone: 'text-solar-amber' },
  cloudy: { icon: Cloud, tone: 'text-text-secondary' },
  rainy: { icon: CloudRain, tone: 'text-energy-cyan' },
  storm: { icon: CloudLightning, tone: 'text-warning-amber' },
};

/** Same threshold the metric cards use to flag a critical deficit (kWh). */
export const CRITICAL_DEFICIT_KWH = 0.05;
