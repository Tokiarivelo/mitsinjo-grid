import { useTranslations } from '@/lib/i18n';
import type { CopilotEvidence } from '../types';
import { formatTelemetryChannel } from '../utils/format-telemetry-channel';

/** One engine result as a channel / value table (values as the tool returned them, already rounded). */
export function EvidenceTable({ evidence }: { evidence: CopilotEvidence }) {
  const tCopilot = useTranslations('features.copilot');
  const tChannels = useTranslations('features.copilot.telemetryChannels');
  const tSectors = useTranslations('sectors');
  const tStrategies = useTranslations('strategies');

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60 bg-surface">
      <div className="px-3 pt-2 text-[10px] font-mono text-energy-cyan">{evidence.resultId}</div>
      <table className="w-full text-left font-mono text-[11px]">
        <thead>
          <tr className="border-b border-border/40 bg-surface-elevated text-text-muted text-[10px]">
            <th className="py-2 px-3 font-semibold">{tCopilot('tableChannel')}</th>
            <th className="py-2 px-3 font-semibold">{tCopilot('tableValue')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30 text-text-primary">
          {Object.entries(evidence.fields).map(([k, v]) => (
            <tr key={k} className="hover:bg-surface-elevated/40 transition-colors">
              <td className="py-2.5 px-3 text-text-secondary" title={k}>
                <span className="font-sans font-medium text-text-primary text-xs">
                  {formatTelemetryChannel(k, { tChannels, tSectors, tStrategies })}
                </span>
              </td>
              <td className="py-2.5 px-3 font-semibold text-energy-cyan whitespace-nowrap">
                {String(v)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
