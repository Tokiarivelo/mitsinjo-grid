import { describe, expect, it } from 'vitest';
import { canControl, mqttLoginOk, safeEqual } from '../access';
import { loadConfig } from '../config';

const TOKEN = 'a-long-demo-token-1234';

describe('canControl (bridge token)', () => {
  it('lets everyone control when no token is configured (local use)', () => {
    expect(canControl('/', undefined)).toBe(true);
    expect(canControl(undefined, undefined)).toBe(true);
  });

  it('needs the exact token in the connection URL', () => {
    expect(canControl(`/?token=${TOKEN}`, TOKEN)).toBe(true);
    expect(canControl('/', TOKEN)).toBe(false);
    expect(canControl('/?token=wrong', TOKEN)).toBe(false);
    expect(canControl(`/?token=${TOKEN}x`, TOKEN)).toBe(false);
    expect(
      canControl(`/?token=${encodeURIComponent('a b&c=d-long-token')}`, 'a b&c=d-long-token')
    ).toBe(true);
  });

  it('safeEqual compares strings of any length', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('mqttLoginOk (embedded broker)', () => {
  const expected = { username: 'esp32', password: 'secret-pass' };
  it('is open without configured credentials', () => {
    expect(mqttLoginOk({}, undefined, undefined)).toBe(true);
  });
  it('checks username and password', () => {
    expect(mqttLoginOk(expected, 'esp32', Buffer.from('secret-pass'))).toBe(true);
    expect(mqttLoginOk(expected, 'esp32', 'nope')).toBe(false);
    expect(mqttLoginOk(expected, 'other', 'secret-pass')).toBe(false);
    expect(mqttLoginOk(expected, undefined, undefined)).toBe(false);
  });
});

describe('loadConfig — access settings', () => {
  it('reads the token and MQTT login, empty = unset', () => {
    const c = loadConfig({ BRIDGE_TOKEN: TOKEN, MQTT_USERNAME: 'esp32', MQTT_PASSWORD: 'pw' });
    expect(c.token).toBe(TOKEN);
    expect(c.mqttAuth).toEqual({ username: 'esp32', password: 'pw' });
    expect(loadConfig({ BRIDGE_TOKEN: '' }).token).toBeUndefined();
  });

  it('rejects a short token and a username without password', () => {
    expect(() => loadConfig({ BRIDGE_TOKEN: 'short' })).toThrow();
    expect(() => loadConfig({ MQTT_USERNAME: 'esp32' })).toThrow();
  });
});
