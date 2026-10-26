import { describe, expect, it } from 'vitest';
import enMessages from '../messages/en.json';
import frMessages from '../messages/fr.json';
import mgMessages from '../messages/mg.json';

function getLeafKeys(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, getLeafKeys(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}

describe('i18n Translation Key Parity (PR Validation)', () => {
  const enLeaves = getLeafKeys(enMessages);
  const frLeaves = getLeafKeys(frMessages);
  const mgLeaves = getLeafKeys(mgMessages);

  const enKeySet = new Set(Object.keys(enLeaves));
  const frKeySet = new Set(Object.keys(frLeaves));
  const mgKeySet = new Set(Object.keys(mgLeaves));

  it('French (fr.json) has 100% key parity with English (en.json)', () => {
    const missingInFr = [...enKeySet].filter((k) => !frKeySet.has(k));
    const extraInFr = [...frKeySet].filter((k) => !enKeySet.has(k));

    expect(missingInFr, `Missing keys in fr.json: ${missingInFr.join(', ')}`).toEqual([]);
    expect(extraInFr, `Extra unexpected keys in fr.json: ${extraInFr.join(', ')}`).toEqual([]);
  });

  it('Malagasy (mg.json) has 100% key parity with English (en.json)', () => {
    const missingInMg = [...enKeySet].filter((k) => !mgKeySet.has(k));
    const extraInMg = [...mgKeySet].filter((k) => !enKeySet.has(k));

    expect(missingInMg, `Missing keys in mg.json: ${missingInMg.join(', ')}`).toEqual([]);
    expect(extraInMg, `Extra unexpected keys in mg.json: ${extraInMg.join(', ')}`).toEqual([]);
  });

  it('all translation entries are non-empty strings across all languages', () => {
    for (const [key, val] of Object.entries(enLeaves)) {
      expect(val.trim().length, `Empty value for key "${key}" in en.json`).toBeGreaterThan(0);
    }
    for (const [key, val] of Object.entries(frLeaves)) {
      expect(val.trim().length, `Empty value for key "${key}" in fr.json`).toBeGreaterThan(0);
    }
    for (const [key, val] of Object.entries(mgLeaves)) {
      expect(val.trim().length, `Empty value for key "${key}" in mg.json`).toBeGreaterThan(0);
    }
  });
});
