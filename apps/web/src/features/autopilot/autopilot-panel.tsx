'use client';

import { AutopilotCard } from './autopilot-card';
import { useAutopilot } from './use-autopilot';

/** Deck slot: hook state wired into the card (M10-T1, envelope M10-T3). */
export function AutopilotPanel() {
  const { enabled, setEnabled, envelope, setEnvelope, pending, history, accept, refuse } =
    useAutopilot();
  return (
    <AutopilotCard
      enabled={enabled}
      setEnabled={setEnabled}
      envelope={envelope}
      setEnvelope={setEnvelope}
      pending={pending}
      history={history}
      accept={accept}
      refuse={refuse}
    />
  );
}
