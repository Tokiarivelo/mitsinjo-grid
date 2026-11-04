import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildStudioScene, STUDIO_LIGHT, STUDIO_MESHES, STUDIO_SIGMA } from '../utils/studio-env';

const meshes = (scene: THREE.Scene) => {
  const out: THREE.Mesh[] = [];
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(o);
  });
  return out;
};

describe('softbox studio (PT-2)', () => {
  it('builds shell, top softbox, two side strips, kicker and floor', () => {
    const { scene, dispose } = buildStudioScene();
    expect(meshes(scene)).toHaveLength(STUDIO_MESHES);
    dispose();
  });

  it('top softbox is the brightest light, every light brighter than the room', () => {
    const { top, side, kicker, room, floor } = STUDIO_LIGHT;
    expect(top).toBeGreaterThan(side);
    expect(side).toBeGreaterThan(kicker);
    expect(Math.min(top, side, kicker)).toBeGreaterThan(room);
    expect(floor).toBeLessThan(room);
    expect(STUDIO_SIGMA).toBeLessThan(0.04);
  });

  it('the top softbox faces the object from above', () => {
    const { scene, dispose } = buildStudioScene();
    const top = meshes(scene).find(
      (m) => (m.material as THREE.MeshBasicMaterial).color.r === STUDIO_LIGHT.top
    )!;
    expect(top.position.y).toBeGreaterThan(5);
    const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(top.quaternion);
    expect(facing.dot(top.position.clone().normalize().negate())).toBeGreaterThan(0.99);
    dispose();
  });

  it('dispose frees every geometry and material', () => {
    const { scene, dispose } = buildStudioScene();
    const spies = meshes(scene).flatMap((m) => [
      vi.spyOn(m.geometry, 'dispose'),
      vi.spyOn(m.material as THREE.Material, 'dispose'),
    ]);
    dispose();
    expect(spies).toHaveLength(2 * STUDIO_MESHES);
    for (const s of spies) expect(s).toHaveBeenCalledOnce();
  });
});
