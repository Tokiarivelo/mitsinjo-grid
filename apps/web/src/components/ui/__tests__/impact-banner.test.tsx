import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SimWarning } from '@mitsinjo/engine';
import { ImpactBanner } from '../impact-banner';
import { I18nProvider } from '@/lib/i18n';

const renderBanner = (warnings: SimWarning[]) =>
  render(
    <I18nProvider>
      <ImpactBanner warnings={warnings} />
    </I18nProvider>
  );

describe('ImpactBanner titles (states-copy)', () => {
  it('shows the nominal title when there are no warnings', () => {
    renderBanner([]);
    expect(screen.getByText('Essential services fully supplied')).toBeInTheDocument();
  });

  it('keeps CRITICAL_UNMET generic (no sector, so it may be water, not the clinic)', () => {
    renderBanner([{ code: 'CRITICAL_UNMET', fromHour: 18, toHour: 20 } as SimWarning]);
    expect(screen.getByText('Critical Service Outage')).toBeInTheDocument();
    expect(screen.queryByText('Clinic supply below target')).not.toBeInTheDocument();
  });

  it('names the sector for SECTOR_PARTIAL on health and water', () => {
    renderBanner([
      { code: 'SECTOR_PARTIAL', sector: 'health', fromHour: 18, toHour: 19 } as SimWarning,
      { code: 'SECTOR_PARTIAL', sector: 'water', fromHour: 18, toHour: 19 } as SimWarning,
    ]);
    expect(screen.getByText('Clinic supply below target')).toBeInTheDocument();
    expect(screen.getByText('Water pumping demand partially unmet')).toBeInTheDocument();
  });

  it('uses the battery-depleted title for RESERVE_REACHED', () => {
    renderBanner([{ code: 'RESERVE_REACHED', fromHour: 21, toHour: 23 } as SimWarning]);
    expect(screen.getByText('Battery reserve depleted before simulation end')).toBeInTheDocument();
  });

  it('renders ANOMALY_TO_VERIFY warning badge and title (PX-T2)', () => {
    renderBanner([
      { code: 'ANOMALY_TO_VERIFY', sector: 'market', fromHour: 11, toHour: 14 } as SimWarning,
    ]);
    expect(screen.getByText('Anomaly Signal to Verify')).toBeInTheDocument();
    expect(screen.getByText(/Requires verification/i)).toBeInTheDocument();
  });

  it('renders SECTOR_CAPPED warning badge and title (PY-T1, PY-T4)', () => {
    renderBanner([
      { code: 'SECTOR_CAPPED', sector: 'market', fromHour: 18, toHour: 22 } as SimWarning,
    ]);
    expect(screen.getByText('Sector Capacity Cap Active')).toBeInTheDocument();
  });
});
