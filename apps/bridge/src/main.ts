import { createServer } from 'node:net';
import { Aedes } from 'aedes';
import { BridgeClientMessageSchema } from '@mitsinjo/engine';
import mqtt from 'mqtt';
import { WebSocket, WebSocketServer } from 'ws';
import { canControl, mqttLoginOk } from './access';
import { loadConfig, TOPICS } from './config';
import { readEnv } from './env-files';
import { BridgeSession } from './session';

/** Seconds between two engine runs / commands (the model publishes telemetry at ~1 Hz). */
const TICK_MS = 1000;

async function main(): Promise<void> {
  const config = loadConfig(readEnv());

  if (config.embeddedBroker) {
    const broker = await Aedes.createBroker();
    broker.authenticate = (_client, username, password, done) =>
      done(null, mqttLoginOk(config.mqttAuth, username, password));
    await new Promise<void>((resolve) =>
      createServer(broker.handle).listen(config.mqttPort, resolve)
    );
    console.log(`[bridge] MQTT broker on :${config.mqttPort}`);
  }

  const session = new BridgeSession(config);
  const start = Date.now();
  const elapsed = () => Date.now() - start;

  const client = mqtt.connect(config.mqttUrl, { clientId: 'mitsinjo-bridge', ...config.mqttAuth });
  client.on('connect', () => {
    client.subscribe(TOPICS.telemetry);
    console.log(`[bridge] MQTT connected to ${config.mqttUrl}`);
  });
  client.on('error', (err) => console.error(`[bridge] MQTT error: ${err.message}`));
  client.on('message', (_topic, payload) => {
    let raw: unknown;
    try {
      raw = JSON.parse(payload.toString());
    } catch {
      return;
    }
    if (!session.ingest(raw, elapsed())) console.warn('[bridge] invalid telemetry frame ignored');
  });

  const wss = new WebSocketServer({ port: config.wsPort });
  let last = '';
  wss.on('connection', (ws, req) => {
    const control = canControl(req.url, config.token);
    ws.send(JSON.stringify({ type: 'access', control }));
    if (last) ws.send(last);
    // The web app may ask for a cloud on the sun lamp (forwarded to the firmware) or a new speed.
    ws.on('message', (data) => {
      let raw: unknown;
      try {
        raw = JSON.parse(data.toString());
      } catch {
        return;
      }
      const msg = BridgeClientMessageSchema.safeParse(raw);
      if (!msg.success) return;
      if (!control) {
        console.warn('[bridge] command ignored: missing or wrong token (read-only client)');
        return;
      }
      if (msg.data.type === 'cloud') {
        client.publish(TOPICS.cloud, JSON.stringify({ on: msg.data.on }));
      } else if (session.setTimeScale(msg.data.timeScale, elapsed())) {
        console.log(`[bridge] speed: 1 h = ${msg.data.timeScale} s`);
      }
    });
  });
  console.log(
    `[bridge] ${config.mode} · ${config.scenarioId} · ${config.strategy} · 1 W = ${config.scale.powerScale / 1000} kW · 1 h = ${config.scale.timeScale} s · ws://localhost:${config.wsPort}`
  );
  console.log(
    `[bridge] commands: ${config.token ? 'token required' : 'open (no BRIDGE_TOKEN)'} · MQTT login: ${config.mqttAuth.username ? 'on' : 'off'}`
  );

  let lastHour = -1;
  setInterval(() => {
    const state = session.tick(elapsed());
    client.publish(TOPICS.command, JSON.stringify(state.command));
    last = JSON.stringify({ type: 'state', state });
    for (const ws of wss.clients) if (ws.readyState === WebSocket.OPEN) ws.send(last);
    if (state.simHour !== lastHour) {
      lastHour = state.simHour;
      const device = state.deviceOnline ? 'model online' : 'model offline';
      console.log(
        `[bridge] day ${state.day + 1} ${String(state.simHour).padStart(2, '0')}:00 · ${state.command.mode} · ${device}`
      );
    }
  }, TICK_MS);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
