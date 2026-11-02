import { z } from 'zod';
import type { AutopilotSuggestion } from './autopilot';

/**
 * Autonomy envelope (M10-T3): what the AI may apply ALONE in simulation, set by the operator.
 * Off by default — outside the envelope, every suggestion needs the operator's tap.
 */

export const AutonomyEnvelopeSchema = z.object({
  /** The AI may switch strategy alone (autopilot R1). */
  strategyChange: z.boolean(),
  /** The AI may set the clinic lifeline floor alone (autopilot R2). */
  clinicFloor: z.boolean(),
});
export type AutonomyEnvelope = z.infer<typeof AutonomyEnvelopeSchema>;

export const ENVELOPE_OFF: AutonomyEnvelope = { strategyChange: false, clinicFloor: false };

export function withinEnvelope(
  envelope: AutonomyEnvelope,
  suggestion: AutopilotSuggestion
): boolean {
  return suggestion.rule === 'strategy' ? envelope.strategyChange : envelope.clinicFloor;
}
