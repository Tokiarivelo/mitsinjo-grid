'use client';

import { publicEnv } from '@/lib/env';
import { useBridgeTarget } from '../hooks/use-bridge-target';
import { useHardwareLink } from '../hooks/use-hardware-link';
import { bridgeSocketUrl } from '../utils/bridge-target';
import { HardwareLinkPanel } from './hardware-link-panel';

export interface HardwareLinkSectionProps {
  /**
   * Fallback bridge WebSocket URL (default NEXT_PUBLIC_BRIDGE_URL). A `?bridge=` link wins over it.
   * No bridge at all → renders nothing.
   */
  url?: string;
  className?: string;
}

/** Scale-model panel wired to the bridge. Hidden when no bridge URL is configured (production). */
export function HardwareLinkSection({
  url = publicEnv.NEXT_PUBLIC_BRIDGE_URL,
  className,
}: HardwareLinkSectionProps) {
  const target = useBridgeTarget(url);
  const link = useHardwareLink(target ? bridgeSocketUrl(target) : undefined);
  if (!target) return null;
  return (
    <HardwareLinkPanel
      status={link.status}
      bridge={link.bridge}
      control={link.control}
      following={link.following}
      onToggleFollow={link.toggleFollow}
      cloud={link.cloud}
      onToggleCloud={link.toggleCloud}
      onSpeedChange={link.setSpeed}
      className={className}
    />
  );
}
