import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { scenarios, simulate } from '@mitsinjo/engine';
import { DispatchControllerUnit, VillageScenePlaceholder } from '../index';
import { toSceneModel, BUS_POSITION } from '../utils/to-scene-model';
import { CAMERA_PRESETS } from '../ui/camera-controller';
import { VillageViewport } from '@/features/simulation/ui/village-viewport';

// Mock WebGL canvas in JSDOM environment
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-r3f-canvas">{children}</div>
  ),
  useFrame: vi.fn(),
  useThree: () => ({
    camera: {
      position: { copy: vi.fn(), set: vi.fn(), lerp: vi.fn(), distanceTo: vi.fn(() => 0) },
    },
  }),
}));

vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-html-label">{children}</div>
  ),
  ContactShadows: () => <div data-testid="mock-contact-shadows" />,
}));

describe('Microgrid 3D & Viewport Integration (P7-T1..P7-T7)', () => {
  const baselineInput = scenarios.baseline.input;
  const result = simulate(baselineInput, 'proportional');

  it('renders VillageScenePlaceholder with loading spinner', () => {
    render(<VillageScenePlaceholder />);
    expect(screen.getByText(/initializing 3d digital twin/i)).toBeInTheDocument();
  });

  it('renders VillageViewport in 2D mode when WebGL is absent in JSDOM', () => {
    render(
      <VillageViewport
        input={baselineInput}
        result={result}
        selectedSector={null}
        onSelectSector={vi.fn()}
        timeIndex={12}
      />
    );

    // In JSDOM, isWebGLAvailable returns false, falling back to 2D
    expect(screen.getByText(/3d visualization is unavailable on this device/i)).toBeInTheDocument();
    // 5 sector nodes must be present
    expect(screen.getByText(/health clinic/i)).toBeInTheDocument();
    expect(screen.getByText(/water pumping/i)).toBeInTheDocument();
    expect(screen.getByText(/primary school/i)).toBeInTheDocument();
    expect(screen.getByText(/village households/i)).toBeInTheDocument();
    expect(screen.getByText(/local market/i)).toBeInTheDocument();
  });

  it('defines CAMERA_PRESETS.controller targeting BUS_POSITION (PL-T7)', () => {
    expect(CAMERA_PRESETS.controller).toBeDefined();
    expect(CAMERA_PRESETS.controller.target).toEqual([BUS_POSITION[0], 1.1, BUS_POSITION[2]]);
  });

  it('renders DispatchControllerUnit with status HUD badge and handles focus clicks (PL-T7)', () => {
    const model = toSceneModel({ input: baselineInput, result, timeIndex: 12 });
    const onFocus = vi.fn();

    render(
      <DispatchControllerUnit
        model={model.controller}
        totalServedKw={12.4}
        onFocus={onFocus}
        nameLabel="EMS Dispatch"
      />
    );

    const button = screen.getByRole('button', { name: /EMS Dispatch/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent(/12\.4 kW/i);

    fireEvent.click(button);
    expect(onFocus).toHaveBeenCalled();
  });
});
