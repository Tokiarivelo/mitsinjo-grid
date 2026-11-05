import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import {
  INK_FRAGMENT,
  INK_STRENGTH,
  INK_TOKEN,
  InkEffect,
  inkColorFromTheme,
  NO_FADE,
  SCENE_INK_TOKEN,
} from '../utils/ink-effect';

const uniform = (e: InkEffect, name: string) => e.uniforms.get(name)!.value;

describe('ink effect (PT-4)', () => {
  afterEach(() => document.documentElement.style.removeProperty(INK_TOKEN));

  it('starts at the default strength, black ink', () => {
    const e = new InkEffect();
    expect(uniform(e, 'strength')).toBe(INK_STRENGTH);
    expect((uniform(e, 'inkColor') as THREE.Color).getHex()).toBe(0x000000);
    e.dispose();
  });

  it('setInk updates the uniforms in place, strength clamped to [0, 1]', () => {
    const e = new InkEffect();
    const color = uniform(e, 'inkColor') as THREE.Color;
    e.setInk({ strength: 0.35, color: '#f4f7fb' });
    expect(uniform(e, 'strength')).toBe(0.35);
    expect(uniform(e, 'inkColor')).toBe(color); // same object: no re-upload of a new uniform
    expect(color.getHexString()).toBe('f4f7fb');
    e.setInk({ strength: 4 });
    expect(uniform(e, 'strength')).toBe(1);
    e.setInk({ strength: -1 });
    expect(uniform(e, 'strength')).toBe(0);
    expect(color.getHexString()).toBe('f4f7fb'); // colour untouched when not given
    e.dispose();
  });

  it('crease weight and distance fade (PT-6): defaults off, clamped, near < far kept', () => {
    const e = new InkEffect();
    expect(uniform(e, 'creaseWeight')).toBe(1);
    expect([uniform(e, 'fadeNear'), uniform(e, 'fadeFar')]).toEqual([...NO_FADE]);
    e.setInk({ crease: 0, fade: [22, 45] });
    expect(uniform(e, 'creaseWeight')).toBe(0);
    expect([uniform(e, 'fadeNear'), uniform(e, 'fadeFar')]).toEqual([22, 45]);
    e.setInk({ crease: 3, fade: [50, 10] });
    expect(uniform(e, 'creaseWeight')).toBe(1);
    expect(uniform(e, 'fadeFar') as number).toBeGreaterThan(uniform(e, 'fadeNear') as number);
    e.dispose();
  });

  it('reads the village ink from its own token', () => {
    document.documentElement.style.setProperty(SCENE_INK_TOKEN, '#0b1220');
    expect(inkColorFromTheme(document.documentElement, SCENE_INK_TOKEN)).toBe('#0b1220');
    document.documentElement.style.removeProperty(SCENE_INK_TOKEN);
  });

  it('reads the ink colour from the theme token, null when unset', () => {
    expect(inkColorFromTheme()).toBeNull();
    document.documentElement.style.setProperty(INK_TOKEN, ' #0f172a ');
    expect(inkColorFromTheme()).toBe('#0f172a');
  });

  it('shader guards: every pow base clamped, every smoothstep edge rising', () => {
    const pows = [...INK_FRAGMENT.matchAll(/pow\(([^,]+)/g)].map((m) => m[1]!.trim());
    expect(pows.length).toBeGreaterThan(0);
    for (const base of pows) expect(base).toMatch(/^(clamp|max)\(/);
    const steps = [...INK_FRAGMENT.matchAll(/smoothstep\(([\d.]+),\s*([\d.]+)/g)];
    expect(steps.length).toBeGreaterThan(0);
    for (const [, a, b] of steps) expect(Number(a)).toBeLessThan(Number(b));
  });

  it('reads depth only (no normal pass)', () => {
    expect(INK_FRAGMENT).toContain('readDepth');
    expect(INK_FRAGMENT).not.toContain('normalBuffer');
  });
});
