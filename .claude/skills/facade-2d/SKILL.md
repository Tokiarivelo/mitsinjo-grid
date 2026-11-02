---
name: facade-2d
description: Specialist in architectural 2D facade imagination using Meta Muse Image — crafts direct orthographic elevation prompts, manages 2D unoccluded projections, user retry loops with additional prompt details, and deletion from R2 / local server storage before passing to the 3D pipeline. Use when generating, refining, or inspecting 2D facades before 3D shape reconstruction.
---

# Specialist Skill: 2D Architectural Facade Imagination

Specialist role: **Architectural Facade & Orthographic Projection Specialist**.

Before any 3D generation, this specialist imagines the complete, unoccluded 2D front facade of the object using Meta Muse Image (`muse-image-1.0`), provides an interactive retry loop with user prompts, and manages storage lifecycle (Cloudflare R2 / server storage) with on-demand deletion.

## Principles

1. **Strict Orthographic Elevation**:
   - Zero perspective distortion, eye-level straight-on angle (0° pitch, 0° yaw).
   - Clean, solid neutral background (studio/white/slate), sharp silhouette edges.
   - Complete object: no occlusions, no cropping, no foreground obstacles.
2. **Context & Archetype Grounding**:
   - Rural Malagasy / microgrid context when applicable (corrugated metal roof, wood, brick, stone, thatched hut).
   - Archetype-specific features:
     - `house` / `building`: roofline (gables/hip/flat), doors, symmetrical windows, facade textures.
     - `vehicle`: front bumper, grille, headlights, windshield rake.
     - `cabinet` / `machine` / `panel`: clean product front elevation, control panels, handles.
3. **User Prompt Incorporation**:
   - When the operator supplies additional prompt details (e.g. "red corrugated iron roof, central wooden door"), seamlessly merge them into the prompt without breaking the orthographic projection constraints.
4. **Lifecycle & Deletion**:
   - Images are uploaded to Cloudflare R2 under `vision/facades/` (or server fallback) with a unique key.
   - Operators can consult the image and permanently purge it at any time via `DELETE /api/vision/facade?key=...`.
