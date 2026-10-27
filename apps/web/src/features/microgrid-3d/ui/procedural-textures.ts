'use client';

import * as THREE from 'three';

/**
 * Tiny canvas textures generated once on the client (no image downloads):
 * corrugated metal, PV cell grid, striped market canvas. Cached per key.
 */
const cache = new Map<string, THREE.Texture>();

function make(
  key: string,
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D) => void,
  srgb = true
) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (g) draw(g);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

/** Corrugated sheet: grayscale ridges, used as color multiplier and bump map. u = along eave. */
export function corrugatedTexture(): THREE.Texture {
  return make('corrugated', 64, 8, (g) => {
    for (let x = 0; x < 64; x++) {
      const v = 0.72 + 0.28 * Math.sin((x / 64) * Math.PI * 2 * 8);
      const c = Math.round(v * 255);
      g.fillStyle = `rgb(${c},${c},${c})`;
      g.fillRect(x, 0, 1, 8);
    }
  });
}

/** PV module: dark blue cells with thin silver bus lines and a light frame. */
export function solarCellTexture(): THREE.Texture {
  return make('pv', 128, 64, (g) => {
    g.fillStyle = '#c9d3e0';
    g.fillRect(0, 0, 128, 64);
    const cols = 12;
    const rows = 6;
    const cw = 128 / cols;
    const ch = 64 / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const shade = 30 + ((i * 7 + j * 13) % 9);
        g.fillStyle = `rgb(${shade - 10},${shade + 20},${shade + 85})`;
        g.fillRect(i * cw + 0.8, j * ch + 0.8, cw - 1.6, ch - 1.6);
      }
    }
  });
}

/** Striped awning canvas (two colors). */
export function stripeTexture(a: string, b: string): THREE.Texture {
  return make(`stripe-${a}-${b}`, 32, 4, (g) => {
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 === 0 ? a : b;
      g.fillRect(i * 8, 0, 8, 4);
    }
  });
}
