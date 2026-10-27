# 3D asset credits

All files in this folder are CC0 (public domain). No attribution required; listed for provenance.

| File                                     | Source                                                     | License |
| ---------------------------------------- | ---------------------------------------------------------- | ------- |
| `nature.glb` (palms, bushes, rocks)      | [Kenney — Nature Kit](https://kenney.nl/assets/nature-kit) | CC0     |
| `ambulance.glb`, `truck.glb`, `van.glb`  | [Kenney — Car Kit](https://kenney.nl/assets/car-kit)       | CC0     |
| `sunset_1k.hdr` (Aarfontein Sunrise, 1k) | [Poly Haven](https://polyhaven.com/a/aarfontein_sunrise)   | CC0     |

Models were merged and compressed with `@gltf-transform/cli optimize --compress meshopt`
(nature: `--palette false` to keep per-part materials). Broadleaf trees, terrain, sky and all
buildings are procedural (`src/features/microgrid-3d`).
