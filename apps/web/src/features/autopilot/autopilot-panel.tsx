'use client';

import { AutopilotCard } from './autopilot-card';
import { DispatchModeToggle } from './ui/dispatch-mode-toggle';
import { useAutopilot } from './use-autopilot';

export interface AutopilotPanelProps {
  onOpenLog?: () => void;
}

/** Deck slot: hook state wired into the card (M10-T1, envelope M10-T3) + 3-mode toggle (PA-T4a). */
export function AutopilotPanel({ onOpenLog }: AutopilotPanelProps = {}) {
  const {
    enabled,
    setEnabled,
    envelope,
    setEnvelope,
    pending,
    history,
    accept,
    refuse,
    dispatchMode,
  } = useAutopilot();
  return (
    <div className="flex flex-col gap-3">
      <DispatchModeToggle variant="card" onOpenLog={onOpenLog} />
      {dispatchMode === 'assisted' && (
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
      )}
    </div>
  );
}
