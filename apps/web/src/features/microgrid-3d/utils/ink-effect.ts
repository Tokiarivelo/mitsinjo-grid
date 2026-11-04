import { Effect, EffectAttribute } from 'postprocessing';
import * as THREE from 'three';

/** Default ink strength (0 = none, 1 = full ink colour on an edge). */
export const INK_STRENGTH = 0.5;

/**
 * Ink outline (PT-4), depth only: no normal pass, no extra scene render. Two edge kinds from the linear
 * depth of the pixel and its four neighbours:
 * - silhouette: the depth Laplacian relative to the pixel's depth (one object in front of another);
 * - crease: the slope on each side differs (a fold on one surface), the depth-derived normal break.
 * Ink fades out between `fade` near and far (view distance), so a far forest does not turn to noise.
 * Every `pow` base is clamped (NaN guard); every `smoothstep` has its low edge first (ANGLE rule).
 */
export const INK_FRAGMENT = /* glsl */ `
uniform float strength;
uniform vec3 inkColor;
uniform float creaseWeight;
uniform float fadeNear;
uniform float fadeFar;

float linearDepth(const in vec2 uv) {
  return max(-getViewZ(readDepth(uv)), 1e-4);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  float c = linearDepth(uv);
  float l = linearDepth(uv - vec2(texelSize.x, 0.0));
  float r = linearDepth(uv + vec2(texelSize.x, 0.0));
  float d = linearDepth(uv - vec2(0.0, texelSize.y));
  float u = linearDepth(uv + vec2(0.0, texelSize.y));

  float laplacian = abs(l + r + u + d - 4.0 * c) / c;
  float silhouette = smoothstep(0.015, 0.06, laplacian);

  float eps = 0.002 * c;
  float breakX = abs((r - c) - (c - l)) / (abs(r - c) + abs(c - l) + eps);
  float breakY = abs((u - c) - (c - d)) / (abs(u - c) + abs(c - d) + eps);
  float crease = smoothstep(0.45, 0.85, max(breakX, breakY));

  float edge = pow(clamp(max(silhouette, creaseWeight * crease), 0.0, 1.0), 0.8);
  float fade = 1.0 - smoothstep(fadeNear, fadeFar, c);
  float k = clamp(edge * strength * fade, 0.0, 1.0);
  outputColor = vec4(mix(inputColor.rgb, inkColor, k), max(inputColor.a, k));
}
`;

/** No distance fade: far beyond any camera's far plane. */
export const NO_FADE: readonly [number, number] = [1e6, 2e6];

export interface InkOptions {
  strength?: number;
  /** Weight of the crease ink (folds on one surface), 0–1; silhouettes always ink. */
  crease?: number;
  /** View distance where the ink starts and ends fading out (near < far). */
  fade?: readonly [number, number];
  /** Ink colour (sRGB, any CSS colour three.js parses). */
  color?: THREE.ColorRepresentation;
}

/** Ink outline effect: merge it into an existing `EffectPass` (one shader, no extra render target). */
export class InkEffect extends Effect {
  constructor({
    strength = INK_STRENGTH,
    color = '#000000',
    crease = 1,
    fade = NO_FADE,
  }: InkOptions = {}) {
    super('InkEffect', INK_FRAGMENT, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ['strength', new THREE.Uniform(strength)],
        ['inkColor', new THREE.Uniform(new THREE.Color(color))],
        ['creaseWeight', new THREE.Uniform(crease)],
        ['fadeNear', new THREE.Uniform(fade[0])],
        ['fadeFar', new THREE.Uniform(fade[1])],
      ]),
    });
  }

  /** Updates the uniforms in place (no recompile): strength and crease clamped to [0, 1]. */
  setInk({ strength, color, crease, fade }: InkOptions): void {
    const unit = (v: number) => Math.min(1, Math.max(0, v));
    if (strength !== undefined) this.uniforms.get('strength')!.value = unit(strength);
    if (crease !== undefined) this.uniforms.get('creaseWeight')!.value = unit(crease);
    if (fade !== undefined) {
      const [near, far] = fade;
      // smoothstep needs near < far (ANGLE): keep a gap.
      this.uniforms.get('fadeNear')!.value = Math.max(0, near);
      this.uniforms.get('fadeFar')!.value = Math.max(near + 1e-3, far);
    }
    if (color !== undefined) (this.uniforms.get('inkColor')!.value as THREE.Color).set(color);
  }
}

/** CSS custom property of the ink colour: the theme's primary text, so the ink follows the theme. */
export const INK_TOKEN = '--color-text-primary';
/** Village ink (PT-6): dark in both themes (light ink over a forest reads as snow). */
export const SCENE_INK_TOKEN = '--color-scene-ink';

/** The ink colour from a theme token on `root`, or null when unset (SSR, tests without CSS). */
export function inkColorFromTheme(
  root: Element = document.documentElement,
  token: string = INK_TOKEN
): string | null {
  const v = getComputedStyle(root).getPropertyValue(token).trim();
  return v ? v : null;
}
