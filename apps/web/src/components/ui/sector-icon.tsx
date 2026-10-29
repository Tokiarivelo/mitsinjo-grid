import {
  Factory,
  HeartPulse,
  Home,
  School,
  ShoppingBag,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import type { SectorId } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';

/** One icon + token color per village sector, shared by every screen. */
export const SECTOR_ICON: Record<SectorId, LucideIcon> = {
  health: HeartPulse,
  water: Waves,
  school: School,
  households: Home,
  market: ShoppingBag,
  industry: Factory,
};

export const SECTOR_TEXT_CLASS: Record<SectorId, string> = {
  health: 'text-critical-red',
  water: 'text-energy-cyan',
  school: 'text-warning-amber',
  households: 'text-text-secondary',
  market: 'text-solar-amber',
  industry: 'text-network-blue',
};

export interface SectorIconProps {
  sector: SectorId;
  /** False keeps the parent's text color (e.g. on a selected chip). */
  tinted?: boolean;
  className?: string;
}

/** Decorative sector glyph; the sector name must be rendered next to it. */
export function SectorIcon({ sector, tinted = true, className }: SectorIconProps) {
  const Icon = SECTOR_ICON[sector];
  return (
    <Icon
      data-sector={sector}
      className={cn('h-4 w-4 shrink-0', tinted && SECTOR_TEXT_CLASS[sector], className)}
      aria-hidden="true"
    />
  );
}
