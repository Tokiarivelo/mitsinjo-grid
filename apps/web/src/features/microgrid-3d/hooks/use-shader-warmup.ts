import { useEffect, useState } from 'react';
import type * as THREE from 'three';

/** Longest wait for the shaders before the canvas shows anyway. */
export const WARMUP_TIMEOUT_MS = 1000;

/** What `<Canvas onCreated>` hands over: the renderer, its scene and camera. */
export interface WarmupTarget {
  gl: Pick<THREE.WebGLRenderer, 'compileAsync'>;
  scene: THREE.Object3D;
  camera: THREE.Camera;
}

/**
 * Shader warm-up (PT-7): once a canvas exists, compile every material of its scene with
 * `gl.compileAsync` (parallel compile via `KHR_parallel_shader_compile` where the driver has it), so the
 * first visible frame does not stall on shader linking. `ready` turns true when it resolves, fails or after
 * `timeoutMs`, whichever comes first: fade the canvas in on it.
 */
export function useShaderWarmup(
  target: WarmupTarget | null,
  timeoutMs = WARMUP_TIMEOUT_MS
): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!target) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setReady(true);
    };
    const id = window.setTimeout(finish, timeoutMs);
    let compiling: Promise<unknown> | undefined;
    try {
      compiling = target.gl.compileAsync?.(target.scene, target.camera);
    } catch {
      compiling = undefined;
    }
    if (compiling) compiling.then(finish, finish);
    else finish();
    return () => {
      done = true;
      window.clearTimeout(id);
    };
  }, [target, timeoutMs]);
  return ready;
}
