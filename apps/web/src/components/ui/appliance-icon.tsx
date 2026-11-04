import {
  Droplets,
  Fan,
  Lamp,
  Laptop,
  Monitor,
  Plug,
  Radio,
  Refrigerator,
  Scissors,
  Smartphone,
  Snowflake,
  Syringe,
  Tv,
  Wheat,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { ApplianceCategory } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';

/** One icon per appliance category, shared by every screen (PT-11c). `other` → plug. */
export const APPLIANCE_ICON: Record<ApplianceCategory, LucideIcon> = {
  fridge: Refrigerator,
  freezer: Snowflake,
  fridge_vaccine: Syringe,
  tv: Tv,
  lamp: Lamp,
  fan: Fan,
  laptop: Laptop,
  phone_charger: Smartphone,
  radio: Radio,
  water_pump: Droplets,
  rice_mill: Wheat,
  sewing_machine: Scissors,
  welder: Zap,
  computer: Monitor,
  other: Plug,
};

export interface ApplianceIconProps {
  category: ApplianceCategory;
  className?: string;
}

/** Decorative appliance glyph; the appliance name must be rendered next to it. */
export function ApplianceIcon({ category, className }: ApplianceIconProps) {
  const Icon = APPLIANCE_ICON[category] ?? Plug;
  return <Icon aria-hidden="true" data-appliance-icon={category} className={cn(className)} />;
}
