/**
 * Detects WebGL / WebGL2 capability in browser environment.
 * Safe for SSR and headless execution.
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

/** Pure: does a WebGL renderer string name a CPU (software) rasterizer? */
export function isSoftwareRendererName(renderer: string): boolean {
  return /swiftshader|llvmpipe|softpipe|software|basic render driver|mesa offscreen/i.test(
    renderer
  );
}

/**
 * True when WebGL runs on the CPU (no GPU, headless CI, blocked drivers). The
 * high tier is unusable there: one frame can take seconds and freeze the page.
 */
let softwareRendererCache: boolean | null = null;

export function isSoftwareRenderer(): boolean {
  if (typeof document === 'undefined') return false;
  if (softwareRendererCache !== null) return softwareRendererCache;
  softwareRendererCache = detectSoftwareRenderer();
  return softwareRendererCache;
}

function detectSoftwareRenderer(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return isSoftwareRendererName(name);
  } catch {
    return false;
  }
}
