import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyPatch,
  DEFAULT_HARDWARE_SCALE,
  scenarios,
  simulate,
  toHardwareCommand,
  type BridgeState,
  type InputPatch,
} from '@mitsinjo/engine';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import {
  BRIDGE_STORAGE_KEY,
  bridgeSocketUrl,
  deviceRunKey,
  HardwareLinkSection,
  parseBridgeMessage,
  parseBridgeUrl,
  parseStoredTarget,
  RECONNECT_MS,
  resolveBridgeTarget,
  stripBridgeParams,
} from '../index';

function bridgeState(over: Partial<BridgeState> = {}, patch: InputPatch = {}): BridgeState {
  const scenarioId = over.scenarioId ?? 'cloudy_afternoon';
  const strategy = over.strategy ?? 'essential_first';
  const simHour = over.simHour ?? 13;
  const base = scenarios[scenarioId].input;
  const input = Object.keys(patch).length > 0 ? applyPatch(base, patch) : base;
  return {
    v: 1,
    mode: 'twin',
    scenarioId,
    strategy,
    day: 0,
    simHour,
    patch,
    deviceOnline: true,
    scale: DEFAULT_HARDWARE_SCALE,
    command: toHardwareCommand(input, simulate(input, strategy), simHour, DEFAULT_HARDWARE_SCALE),
    ...over,
  };
}

const message = (state: BridgeState) => JSON.stringify({ type: 'state', state });

/** Minimal WebSocket stand-in driven by the test. */
class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
  receive(data: string) {
    this.onmessage?.({ data });
  }
}

describe('bridge message utils (PH-H4)', () => {
  it('parses a valid state and rejects malformed or out-of-range payloads', () => {
    const state = bridgeState();
    expect(parseBridgeMessage(message(state))).toEqual({ type: 'state', state });
    expect(parseBridgeMessage('{"type":"access","control":false}')).toEqual({
      type: 'access',
      control: false,
    });
    expect(parseBridgeMessage('not json')).toBeNull();
    expect(parseBridgeMessage(JSON.stringify({ type: 'other', state }))).toBeNull();
    expect(parseBridgeMessage(message({ ...state, simHour: 30 }))).toBeNull();
    expect(parseBridgeMessage(42)).toBeNull();
  });

  it('run key changes with the hour or the measured patch only', () => {
    const a = bridgeState();
    expect(deviceRunKey(a)).toBe(deviceRunKey({ ...a, deviceOnline: false }));
    expect(deviceRunKey(a)).not.toBe(deviceRunKey({ ...a, simHour: 14 }));
    expect(deviceRunKey(a)).not.toBe(
      deviceRunKey({ ...a, patch: { solarProfile: Array(24).fill(0.1) } })
    );
  });
});

describe('bridge target (PH-H8-T1)', () => {
  it('accepts only WebSocket URLs', () => {
    expect(parseBridgeUrl('wss://bridge.example.org')).toBe('wss://bridge.example.org/');
    expect(parseBridgeUrl('ws://localhost:8787')).toBe('ws://localhost:8787/');
    expect(parseBridgeUrl('https://evil.example')).toBeNull();
    expect(parseBridgeUrl('javascript:alert(1)')).toBeNull();
    expect(parseBridgeUrl('not a url')).toBeNull();
    expect(parseBridgeUrl(null)).toBeNull();
  });

  it('link beats stored beats env; ?bridge=off clears the stored one', () => {
    const stored = { url: 'ws://stored:1/' };
    expect(
      resolveBridgeTarget('?bridge=ws://link:2&bridgeToken=t0k', stored, 'ws://env:3')
    ).toEqual({
      target: { url: 'ws://link:2/', token: 't0k' },
      persist: { url: 'ws://link:2/', token: 't0k' },
    });
    expect(resolveBridgeTarget('', stored, 'ws://env:3')).toEqual({ target: stored });
    expect(resolveBridgeTarget('', null, 'ws://env:3')).toEqual({ target: { url: 'ws://env:3' } });
    expect(resolveBridgeTarget('', null, undefined)).toEqual({ target: null });
    expect(resolveBridgeTarget('?bridge=off', stored, undefined)).toEqual({
      target: null,
      persist: null,
    });
    // An invalid link is ignored, never stored.
    expect(resolveBridgeTarget('?bridge=http://x', null, undefined)).toEqual({ target: null });
  });

  it('reads stored targets defensively, strips link params, adds the token to the socket URL', () => {
    expect(parseStoredTarget('{"url":"wss://b/","token":"x"}')).toEqual({
      url: 'wss://b/',
      token: 'x',
    });
    expect(parseStoredTarget('{"url":"http://b/"}')).toBeNull();
    expect(parseStoredTarget('oops')).toBeNull();
    expect(stripBridgeParams('?bridge=ws://a&bridgeToken=t&tab=controls')).toBe('?tab=controls');
    expect(stripBridgeParams('?bridge=ws://a')).toBe('');
    expect(stripBridgeParams('?tab=controls')).toBeNull();
    expect(bridgeSocketUrl({ url: 'wss://b/' })).toBe('wss://b/');
    expect(bridgeSocketUrl({ url: 'wss://b/', token: 'a b' })).toBe('wss://b/?token=a+b');
  });
});

describe('store applyDeviceRun / releaseDevice (PH-H4)', () => {
  beforeEach(() => resetSimulationStore());

  it('loads the scenario, applies the measured patch and runs the engine at the model hour', () => {
    const patch: InputPatch = {
      solarProfile: scenarios.baseline.input.solar.profile.map((p) => p / 2),
    };
    useSimulationStore
      .getState()
      .applyDeviceRun(bridgeState({ scenarioId: 'baseline', simHour: 9 }, patch));
    const s = useSimulationStore.getState();
    expect(s.source).toBe('device');
    expect(s.scenarioId).toBe('baseline');
    expect(s.activeStrategy).toBe('essential_first');
    expect(s.timeIndex).toBe(9);
    expect(s.status).toBe('complete');
    expect(s.input.solar.profile).toEqual(patch.solarProfile);
    expect(s.results.essential_first!.metrics.solarKwh).toBeCloseTo(
      simulate(applyPatch(scenarios.baseline.input, patch), 'essential_first').metrics.solarKwh
    );
  });

  it('loading a scenario or releasing stops following the model', () => {
    const store = useSimulationStore.getState();
    store.applyDeviceRun(bridgeState());
    store.releaseDevice();
    expect(useSimulationStore.getState().source).toBe('scenario');
    store.applyDeviceRun(bridgeState());
    store.loadScenario('baseline');
    expect(useSimulationStore.getState().source).toBe('scenario');
  });
});

describe('HardwareLinkSection (PH-H4)', () => {
  beforeEach(() => {
    resetSimulationStore();
    FakeSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('renders nothing without a bridge URL', () => {
    const { container } = render(<HardwareLinkSection url={undefined} />);
    expect(container).toBeEmptyDOMElement();
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it('connects, shows the model state and follows it into the store', () => {
    render(<HardwareLinkSection url="ws://bridge.test" />);
    const ws = FakeSocket.instances[0]!;
    expect(ws.url).toBe('ws://bridge.test');
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Follow the model' })).toBeDisabled();

    act(() => ws.open());
    act(() => ws.receive(message(bridgeState({ simHour: 13 }))));
    expect(screen.getByText('Bridge connected')).toBeInTheDocument();
    expect(screen.getByText('1 W = 4 kW · 1 h = 20 s')).toBeInTheDocument();
    expect(screen.getByText('Day 1 · 13:00')).toBeInTheDocument();
    expect(useSimulationStore.getState().source).toBe('scenario');

    fireEvent.click(screen.getByRole('button', { name: 'Follow the model' }));
    let s = useSimulationStore.getState();
    expect(s.source).toBe('device');
    expect(s.scenarioId).toBe('cloudy_afternoon');
    expect(s.timeIndex).toBe(13);
    expect(screen.getByText('SCALE MODEL DATA')).toBeInTheDocument();

    act(() => ws.receive(message(bridgeState({ simHour: 14 }))));
    s = useSimulationStore.getState();
    expect(s.timeIndex).toBe(14);

    fireEvent.click(screen.getByRole('button', { name: 'Stop following' }));
    act(() => ws.receive(message(bridgeState({ simHour: 15 }))));
    expect(useSimulationStore.getState().source).toBe('scenario');
    expect(useSimulationStore.getState().timeIndex).toBe(14);
  });

  it('sends the cloud toggle to the bridge', () => {
    render(<HardwareLinkSection url="ws://bridge.test" />);
    const ws = FakeSocket.instances[0]!;
    expect(screen.getByRole('button', { name: 'Cloud over the lamp' })).toBeDisabled();
    act(() => ws.open());
    fireEvent.click(screen.getByRole('button', { name: 'Cloud over the lamp' }));
    expect(JSON.parse(ws.sent[0]!)).toEqual({ type: 'cloud', on: true });
    expect(screen.getByRole('button', { name: 'Remove the cloud' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('asks the bridge for a new speed and shows the confirmed one as pressed', () => {
    render(<HardwareLinkSection url="ws://bridge.test" />);
    const ws = FakeSocket.instances[0]!;
    act(() => ws.open());
    act(() => ws.receive(message(bridgeState())));
    expect(screen.getByRole('button', { name: '1 simulated hour = 20 s' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: '1 simulated hour = 5 s' }));
    expect(JSON.parse(ws.sent[0]!)).toEqual({ type: 'speed', timeScale: 5 });
    // Pressed state follows the bridge, not the click.
    expect(screen.getByRole('button', { name: '1 simulated hour = 5 s' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    const fast = { ...DEFAULT_HARDWARE_SCALE, timeScale: 5 };
    act(() => ws.receive(message(bridgeState({ scale: fast }))));
    expect(screen.getByRole('button', { name: '1 simulated hour = 5 s' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText('1 W = 4 kW · 1 h = 5 s')).toBeInTheDocument();
  });

  it('regression: a late close of the first socket (dev double mount) does not break commands', () => {
    const close = vi.spyOn(FakeSocket.prototype, 'close').mockImplementation(function (
      this: FakeSocket
    ) {
      this.readyState = 3; // real sockets fire onclose later, not during the effect cleanup
    });
    render(
      <StrictMode>
        <HardwareLinkSection url="ws://bridge.test" />
      </StrictMode>
    );
    close.mockRestore();
    const [first, live] = [FakeSocket.instances[0]!, FakeSocket.instances.at(-1)!];
    expect(live).not.toBe(first);
    act(() => live.open());
    act(() => live.receive(message(bridgeState())));
    act(() => first.onclose?.());
    fireEvent.click(screen.getByRole('button', { name: '1 simulated hour = 5 s' }));
    expect(live.sent.map((d) => JSON.parse(d))).toEqual([{ type: 'speed', timeScale: 5 }]);
  });

  it('read-only bridge: commands disabled with a note, nothing sent', () => {
    render(<HardwareLinkSection url="ws://bridge.test" />);
    const ws = FakeSocket.instances[0]!;
    act(() => ws.open());
    act(() => ws.receive('{"type":"access","control":false}'));
    act(() => ws.receive(message(bridgeState())));
    expect(screen.getByText(/Read-only/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cloud over the lamp' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '1 simulated hour = 5 s' })).toBeDisabled();
    // Following stays possible: it only changes this page.
    expect(screen.getByRole('button', { name: 'Follow the model' })).toBeEnabled();
    expect(ws.sent).toHaveLength(0);
  });

  it('a ?bridge= link shows the panel without env, stores it for the tab and cleans the address bar', () => {
    window.history.replaceState(
      null,
      '',
      '/simulation?bridge=wss://demo.example/&bridgeToken=s3cret&tab=x'
    );
    render(<HardwareLinkSection url={undefined} />);
    const ws = FakeSocket.instances[0]!;
    expect(ws.url).toBe('wss://demo.example/?token=s3cret');
    expect(window.location.search).toBe('?tab=x');
    expect(JSON.parse(sessionStorage.getItem(BRIDGE_STORAGE_KEY)!)).toEqual({
      url: 'wss://demo.example/',
      token: 's3cret',
    });
    expect(screen.getByRole('heading', { name: 'Physical scale model' })).toBeInTheDocument();
  });

  it('?bridge=off forgets the stored bridge', () => {
    sessionStorage.setItem(BRIDGE_STORAGE_KEY, JSON.stringify({ url: 'wss://demo.example/' }));
    window.history.replaceState(null, '', '/simulation?bridge=off');
    const { container } = render(<HardwareLinkSection url={undefined} />);
    expect(container).toBeEmptyDOMElement();
    expect(sessionStorage.getItem(BRIDGE_STORAGE_KEY)).toBeNull();
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it('ignores malformed messages and reconnects after the bridge goes away', () => {
    render(<HardwareLinkSection url="ws://bridge.test" />);
    const ws = FakeSocket.instances[0]!;
    act(() => ws.open());
    act(() => ws.receive('{"type":"state","state":{"v":9}}'));
    expect(screen.getByText(/make bridge/)).toBeInTheDocument();

    act(() => ws.close());
    expect(screen.getByText('Bridge offline')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(RECONNECT_MS));
    expect(FakeSocket.instances).toHaveLength(2);
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
  });
});
