import { describe, it, expect } from 'vitest';
import { isSoftwareRenderer, isSoftwareRendererName, isWebGLAvailable } from '../webgl';

describe('isWebGLAvailable (P7-T5)', () => {
  it('returns a boolean value without throwing in jsdom environment', () => {
    const available = isWebGLAvailable();
    expect(typeof available).toBe('boolean');
  });
});

describe('software renderer detection', () => {
  it.each([
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
    'llvmpipe (LLVM 15.0.7, 256 bits)',
    'Microsoft Basic Render Driver',
  ])('flags %s as software', (name) => {
    expect(isSoftwareRendererName(name)).toBe(true);
  });

  it.each(['ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)', 'Apple M2', 'Mali-G78'])(
    'keeps GPU %s on the high tier',
    (name) => {
      expect(isSoftwareRendererName(name)).toBe(false);
    }
  );

  it('never throws without a WebGL context (jsdom)', () => {
    expect(isSoftwareRenderer()).toBe(false);
  });
});
