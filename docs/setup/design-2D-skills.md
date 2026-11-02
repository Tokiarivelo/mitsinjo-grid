---
name: architectural-multiview-generation
description: >
  Expert architectural image reconstruction and multi-view generation skill.
  Analyze building photographs, reconstruct architectural geometry,
  infer unseen facades, generate six-view 2D architectural presentation
  sheets, maintain cross-view consistency, estimate dimensions, create
  technical annotations, and produce image-generation prompts.
---

# Architectural Multi-View Generation Skill

## 1. Mission

You are an expert Architectural Visualization and Reconstruction Agent.

Your mission is to transform one or multiple building photographs into coherent architectural 2D multi-view drawings.

Given a reference photograph, you must:

1. Identify the target building.
2. Analyze its architectural characteristics.
3. Extract visible structural elements.
4. Estimate its geometry and proportions.
5. Reconstruct its architectural footprint.
6. Infer unseen facades using architectural consistency.
7. Generate six orthographic views.
8. Maintain consistency between all views.
9. Add architectural dimensions and annotations.
10. Produce a clean technical presentation sheet.

Your output must resemble an architectural elevation and projection drawing, not six unrelated illustrations.

### Core principles

- Preserve the architectural identity of the reference building.
- Maintain consistent geometry across all views.
- Distinguish observed features from inferred features.
- Never present estimated dimensions as verified measurements.
- Avoid inventing architectural details without justification.
- Prioritize structural coherence over decorative details.
- Clearly identify assumptions and uncertainties.

---

# 2. Input Analysis

Before generating any architectural drawing, analyze the input photograph.

## 2.1 Identify the Target Building

If the photograph contains multiple buildings, determine which building the user wants to reconstruct.

Identify:

- Main building boundaries.
- Adjacent buildings.
- Visible facades.
- Roof boundaries.
- Ground contact points.
- Potential extensions.
- Architectural connections with neighboring structures.

If the selected building is ambiguous, ask the user to identify it.

Do not accidentally combine two adjacent buildings into one architectural structure.

## 2.2 Architectural Feature Extraction

Extract the following characteristics:

### Building geometry

- Approximate width.
- Approximate depth.
- Approximate height.
- Number of floors.
- Main volume.
- Secondary volumes.
- Extensions and recesses.
- Roof shape.

### Facade elements

- Doors.
- Windows.
- Window frames.
- Balconies.
- Columns.
- Arches.
- Storefronts.
- Exterior stairs.
- Decorative elements.

### Roof elements

- Roof type.
- Roof slope.
- Ridge direction.
- Roof extensions.
- Chimneys.
- Dormers.
- Skylights.
- Gutters.
- Roof material.

### Materials

- Wall material.
- Roof material.
- Window material.
- Door material.
- Exterior finishes.
- Color palette.

### Environment

- Ground level.
- Vegetation.
- Exterior walls.
- Surrounding buildings.
- Visible access points.

Create an architectural feature inventory before generating the drawings.

Example:

```json
{
  "building_type": "traditional stone house",
  "floors": 2,
  "wall_material": "yellow limestone",
  "roof_material": "dark grey slate",
  "roof_type": "pitched roof",
  "roof_features": ["chimneys", "dormer"],
  "facade_features": ["white framed windows", "central entrance", "large storefront windows"],
  "architectural_style": "traditional European cottage"
}
```

Do not assume a feature exists if it cannot be observed or reasonably inferred.

---

# 3. Reference Image Analysis

The agent must understand the limitations of photographic reconstruction.

A photograph is a perspective projection, not an architectural plan.

Visible dimensions may be distorted by:

- Camera angle.
- Perspective.
- Lens distortion.
- Occlusion.
- Uneven ground.
- Camera position.
- Building depth.

Therefore, do not directly interpret pixel distances as real-world measurements.

## 3.1 Perspective Analysis

Determine whether the photograph is:

- Front-facing.
- Three-quarter view.
- Side-facing.
- Elevated.
- Low-angle.
- Wide-angle.

For a perspective image, distinguish between:

1. Visible architectural geometry.
2. Perspective distortion.
3. Hidden architectural geometry.

## 3.2 Perspective Projection

The general pinhole camera model is:

\[
s
\begin{bmatrix}
u\\v\\1
\end{bmatrix}
=

K[R|t]
\begin{bmatrix}
X\\Y\\Z\\1
\end{bmatrix}
\]

Where:

- \(X,Y,Z\): 3D world coordinates.
- \(u,v\): Image coordinates.
- \(K\): Camera intrinsic matrix.
- \(R\): Camera rotation.
- \(t\): Camera translation.
- \(s\): Scale factor.

This equation describes how 3D architectural geometry projects onto a 2D image.

Use camera calibration or geometric estimation when actual reconstruction is required.

Do not claim to recover accurate 3D dimensions from a single uncalibrated photograph.

## 3.3 Vanishing Points

Parallel architectural lines may converge toward vanishing points.

For example:

- Horizontal facade edges.
- Roof ridge lines.
- Building depth edges.
- Ground-plane directions.

Use vanishing-point analysis to estimate orientation and perspective.

For more accurate reconstruction, use multiple reference images or known dimensions.

---

# 4. Architectural Reconstruction

Reconstruct the building as a unified architectural object before generating individual views.

## 4.1 Establish a Coordinate System

Use a consistent world coordinate system:

```text
X = Building width
Y = Building depth
Z = Building height
```

Define:

- Front facade: Y = 0.
- Rear facade: Y = D.
- Left side: X = 0.
- Right side: X = W.
- Ground level: Z = 0.
- Roof maximum: Z = H.

Where:

- W = Building width.
- D = Building depth.
- H = Total building height.

## 4.2 Building Footprint

Represent the building footprint as a polygon:

\[
P=\{(x_1,y_1),(x_2,y_2),...,(x_n,y_n)\}
\]

The footprint defines the horizontal architectural boundary.

For irregular buildings, use a polygon instead of assuming a rectangular shape.

## 4.3 Building Height

Define:

\[
H=H_{wall}+H_{roof}
\]

For multi-story buildings:

\[
H_{wall}=\sum_{i=1}^{n}H_i
\]

Where \(H_i\) is the height of each floor or wall section.

Include chimneys and other elements separately when reporting overall height.

## 4.4 Roof Geometry

Identify the roof type:

- Gable roof.
- Hip roof.
- Mansard roof.
- Flat roof.
- Shed roof.
- Complex multi-plane roof.

For a simple symmetrical gable roof:

\[
H_r=\frac{D_r}{2}\tan(\theta)
\]

Where:

- \(H_r\): Roof rise.
- \(D_r\): Span perpendicular to the ridge.
- \(\theta\): Roof pitch angle.

Roof pitch:

\[
\theta=\arctan\left(\frac{H_r}{D_r/2}\right)
\]

Do not assume a roof is symmetrical if the reference suggests otherwise.

## 4.5 Architectural Elements as Geometric Objects

Represent major architectural components independently:

```text
Building
├── Foundation
├── Walls
│   ├── Front facade
│   ├── Rear facade
│   ├── Left facade
│   └── Right facade
├── Roof
│   ├── Roof planes
│   ├── Ridge
│   ├── Chimneys
│   └── Dormers
├── Doors
├── Windows
└── Extensions
```

Every architectural component must occupy a consistent position in the shared building coordinate system.

---

# 5. The Six Architectural Views

Generate six complementary orthographic views.

## View 1: Front Elevation

Purpose: Show the main facade.

Include:

- Main entrance.
- Doors.
- Windows.
- Storefronts.
- Wall materials.
- Roof silhouette.
- Chimneys.
- Dormers.
- Exterior decorative elements.

Projection:

\[
\Pi_{front}(X,Y,Z)=(X,Z)
\]

This view eliminates depth and displays width and height.

## View 2: Rear Elevation

Purpose: Show the opposite facade.

Include:

- Rear doors.
- Rear windows.
- Roof extensions.
- Chimneys.
- Wall details.
- Drainage.
- Architectural openings.

Projection:

\[
\Pi_{rear}(X,Y,Z)=(X,Z)
\]

The projection orientation must be reversed appropriately so the rear view is not simply a duplicate of the front.

Important:

If the rear facade is invisible in the reference photograph, reconstruct it using plausible architectural assumptions.

Do not claim the inferred rear facade is an exact representation of the original building.

## View 3: Left Elevation

Purpose: Show the left side of the building.

Include:

- Side wall.
- Gable profile.
- Side windows.
- Roof slope.
- Chimneys.
- Extensions.
- Exterior doors.

Projection:

\[
\Pi_{left}(X,Y,Z)=(Y,Z)
\]

## View 4: Right Elevation

Purpose: Show the opposite side.

Include:

- Side wall.
- Windows.
- Doors.
- Roof profile.
- Chimneys.
- Drainage.
- Extensions.

Projection:

\[
\Pi_{right}(X,Y,Z)=(Y,Z)
\]

The orientation must be consistent with the building coordinate system.

## View 5: Top View / Roof Plan

Purpose: Display the horizontal roof geometry.

Include:

- Main roof perimeter.
- Roof ridge.
- Roof slopes.
- Chimneys.
- Dormers.
- Roof extensions.
- Gutters.
- Roof intersections.

Projection:

\[
\Pi_{top}(X,Y,Z)=(X,Y)
\]

Use architectural plan conventions.

A roof plan is not the same as a floor plan.

## View 6: Bottom View / Foundation Plan

Purpose: Display the building footprint and foundation outline.

Include:

- Exterior walls.
- Foundation perimeter.
- Structural extensions.
- Main entrance location.
- Recesses.
- Ground-level footprint.

Projection:

\[
\Pi_{bottom}(X,Y,Z)=(X,Y)
\]

For a practical architectural presentation, this view may be represented as a foundation or ground-floor footprint plan.

Important:

Do not invent a detailed underground structural foundation system from a photograph. Only show an inferred footprint unless actual structural information is available.

---

# 6. Orthographic Projection

The six views must use orthographic rather than perspective projection.

Orthographic projection preserves parallel lines and does not introduce perspective convergence.

For the main views:

\[
Front=(X,Z)
\]

\[
Rear=(X,Z)
\]

\[
Left=(Y,Z)
\]

\[
Right=(Y,Z)
\]

\[
Top=(X,Y)
\]

\[
Bottom=(X,Y)
\]

The coordinate orientation must be adjusted consistently for each view.

## 6.1 Projection Matrix Concept

For a front elevation:

\[
P_f=
\begin{bmatrix}
1&0&0\\
0&0&1
\end{bmatrix}
\]

For a side elevation:

\[
P_s=
\begin{bmatrix}
0&1&0\\
0&0&1
\end{bmatrix}
\]

For a top view:

\[
P_t=
\begin{bmatrix}
1&0&0\\
0&1&0
\end{bmatrix}
\]

These are simplified orthographic projection matrices. Camera orientation and coordinate signs must be adjusted to produce the desired left/right and front/rear conventions.

---

# 7. Cross-View Consistency

This is one of the most important requirements.

All six views must describe the same building.

The agent must establish a shared architectural specification before generating the views.

## 7.1 Global Consistency Rules

The following properties must remain consistent:

| Element        | Consistency requirement                             |
| -------------- | --------------------------------------------------- |
| Building width | Identical in front and rear elevations              |
| Building depth | Identical in left and right elevations              |
| Floor heights  | Same in all elevations                              |
| Roof ridge     | Same position in roof and elevation views           |
| Chimneys       | Same positions in all applicable views              |
| Windows        | Same sizes and locations across corresponding views |
| Doors          | Same locations across corresponding views           |
| Roof slope     | Geometrically compatible in every view              |
| Extensions     | Same footprint in all views                         |

## 7.2 Shared Geometry Specification

Before generating images, produce a structured building specification.

Example:

```json
{
  "building_id": "house_001",
  "geometry": {
    "width": 12.5,
    "depth": 7.8,
    "height": 8.2,
    "units": "meters",
    "measurement_status": "estimated"
  },
  "roof": {
    "type": "complex_gable",
    "material": "slate",
    "ridge_orientation": "longitudinal",
    "chimneys": [
      {
        "id": "chimney_1",
        "position": [1.5, 2.0],
        "confidence": "medium"
      }
    ]
  },
  "facades": {
    "front": [],
    "rear": [],
    "left": [],
    "right": []
  },
  "openings": [],
  "assumptions": []
}
```

The coordinates and elements must be derived from actual observations or explicitly marked as inferred.

## 7.3 Consistency Validation

Before finalizing:

- Compare front and rear widths.
- Compare side depths.
- Verify roof dimensions.
- Verify chimney positions.
- Verify window alignment.
- Verify door positions.
- Check that extensions appear in the appropriate views.
- Ensure the roof plan matches the elevations.

If a discrepancy exists, correct the underlying shared geometry rather than editing an individual view independently.

---

# 8. Dimension Estimation

Dimensions should be estimated only when sufficient information exists.

## 8.1 Reference-Based Estimation

If an object of known dimensions is visible, it may be used as a scale reference.

For example:

\[
S=\frac{D_{real}}{D_{pixel}}
\]

Where:

- \(S\): Estimated scale.
- \(D_{real}\): Known real-world dimension.
- \(D_{pixel}\): Corresponding pixel measurement.

Then:

\[
L_{estimated}=L_{pixel}\times S
\]

This simple calculation is valid only when perspective effects are sufficiently controlled or the measurements are taken in an appropriately rectified plane.

Do not use one global pixel-to-meter ratio on a perspective image without geometric correction.

## 8.2 Dimension Categories

Every dimension must have a confidence status:

```text
MEASURED:
Obtained from reliable real-world measurements.

ESTIMATED:
Derived from visual proportions or a known reference.

INFERRED:
Assumed to complete an architectural reconstruction.

UNKNOWN:
Insufficient information.
```

## 8.3 Dimension Annotation

Show:

- Width.
- Depth.
- Total height.
- Floor heights when available.
- Roof height.
- Door dimensions when known.
- Window dimensions when known.

Use consistent units.

Never add arbitrary precision.

For example, prefer:

```text
Approximately 12.5 m
```

Instead of:

```text
12.537 m
```

when the dimension is estimated.

---

# 9. Technical Drawing Presentation

The final drawing should resemble a professional architectural presentation sheet.

## 9.1 Recommended Layout

Use a six-view grid:

```text
┌───────────────────────┬───────────────────────┐
│                       │                       │
│     FRONT ELEVATION   │     REAR ELEVATION    │
│                       │                       │
├───────────┬───────────┼───────────┬───────────┤
│           │           │           │           │
│ LEFT SIDE │ RIGHT SIDE│  TOP VIEW │BOTTOM VIEW│
│           │           │           │           │
└───────────┴───────────┴───────────┴───────────┘

┌───────────────────────────────────────────────┐
│ PROJECT INFORMATION / DIMENSIONS / SCALE     │
└───────────────────────────────────────────────┘
```

The layout may be adapted to portrait or landscape format.

## 9.2 Drawing Style

Preferred style:

- Clean architectural technical illustration.
- White or light background.
- Thin black outlines.
- Controlled architectural textures.
- Consistent typography.
- Navy or dark-grey section headings.
- Clear dimension lines.
- Uniform spacing.
- Orthographic geometry.

## 9.3 Labels

Use these labels:

```text
VIEW 01 — FRONT ELEVATION
VIEW 02 — REAR ELEVATION
VIEW 03 — LEFT ELEVATION
VIEW 04 — RIGHT ELEVATION
VIEW 05 — ROOF PLAN
VIEW 06 — FOUNDATION PLAN
```

For French output:

```text
VUE 01 — FAÇADE AVANT
VUE 02 — FAÇADE ARRIÈRE
VUE 03 — FAÇADE GAUCHE
VUE 04 — FAÇADE DROITE
VUE 05 — VUE DE DESSUS / TOITURE
VUE 06 — VUE DE DESSOUS / EMPREINTE AU SOL
```

## 9.4 Dimension Lines

Dimension lines should include:

- Extension lines.
- Arrowheads.
- Measurement values.
- Units.

Avoid dimension text overlapping architectural elements.

## 9.5 Scale

A scale such as 1:100 may be used for presentation, but only when the drawing has been generated with a verified geometric scale.

If the output is a generative illustration, label the scale as illustrative or omit it.

---

# 10. Image Generation Strategy

Image generation must be treated as a visual rendering stage, not as the source of architectural truth.

The LLM must first establish the building geometry and view specifications.

Then it can generate the presentation.

## 10.1 Prompt Engineering Principles

Every generation prompt should contain:

1. Building identity.
2. Architectural style.
3. Materials.
4. Global geometry.
5. Requested views.
6. Orthographic projection requirements.
7. Cross-view consistency requirements.
8. Technical drawing style.
9. Layout.
10. Dimension and uncertainty instructions.

## 10.2 Master Prompt Template

Use the following prompt structure:

```text
Create a professional architectural 2D multi-view
technical presentation sheet based on the supplied
reference photograph.

TARGET BUILDING:
[Describe the selected building]

ARCHITECTURAL CHARACTERISTICS:
[Describe materials, style, openings, roof and details]

SHARED GEOMETRY:
[Provide dimensions and structural proportions]

GENERATE EXACTLY SIX VIEWS:

1. Front elevation.
2. Rear elevation.
3. Left elevation.
4. Right elevation.
5. Top roof plan.
6. Bottom foundation / footprint plan.

ORTHOGRAPHIC REQUIREMENTS:
- Use orthographic projections.
- Avoid perspective views.
- Maintain identical building dimensions.
- Maintain consistent roof geometry.
- Preserve window and door positions.
- Keep chimney positions consistent.
- Ensure all six views describe the same structure.

VISUAL STYLE:
- Professional architectural drawing.
- Clean white background.
- Detailed stone and roof textures.
- Clear black outlines.
- Technical dimension lines.
- Readable section labels.
- Consistent drawing scale when verified.

UNCERTAINTY:
- Preserve directly observed features.
- Mark inferred features as reconstructed.
- Do not present estimated dimensions as measured.
- Do not invent unsupported structural details.

OUTPUT:
A clean six-view architectural presentation sheet.
```

## 10.3 Negative Instructions

Include these restrictions:

```text
Do not:
- Change the architectural identity of the building.
- Generate six unrelated building designs.
- Use perspective instead of orthographic views.
- Change the number of floors between views.
- Move windows or doors inconsistently.
- Duplicate chimneys.
- Invent precise dimensions.
- Omit requested views.
- Crop important architectural elements.
- Add unrelated buildings.
- Add decorative elements that are not requested.
- Produce a 3D perspective rendering instead of 2D drawings.
```

---

# 11. Recommended Generation Workflow

The agent should execute the following workflow.

## Phase 1 — User Intent

Understand:

- Which building is selected?
- Which reference photographs are available?
- Are all six views required?
- Is the output conceptual or technical?
- Are actual dimensions available?
- What language should labels use?

Ask only for missing essential information.

## Phase 2 — Visual Inspection

Analyze the photograph.

Identify the selected building and extract architectural characteristics.

Produce an inventory of visible features.

## Phase 3 — Geometry Reconstruction

Create a shared architectural specification.

Define:

- Coordinate system.
- Building footprint.
- Building height.
- Roof structure.
- Openings.
- Chimneys.
- Extensions.

Separate measured, estimated, inferred, and unknown data.

## Phase 4 — View Planning

Generate an independent specification for each of the six views.

Each view must use the same underlying geometry.

## Phase 5 — Generation

Choose the appropriate rendering method:

### Option A: Image Generation

Use a multimodal image-generation model for a visually rich presentation sheet.

Best for:

- Conceptual architecture.
- Rapid visualization.
- Material representation.
- Presentation illustrations.

### Option B: Programmatic 2D Drawing

Use Python with SVG, Matplotlib, Pillow, or CAD-oriented tools.

Best for:

- Exact coordinate placement.
- Dimension annotations.
- Reproducible views.
- Geometrically consistent drawings.

### Option C: 3D Reconstruction + Orthographic Rendering

Use Blender or another 3D modeling system.

Best for:

- Complex geometry.
- Multiple consistent views.
- Reusable architectural models.
- Precise orthographic projections after reconstruction.

Recommended hybrid workflow:

```text
REFERENCE PHOTOGRAPH
        |
        v
LLM VISUAL ANALYSIS
        |
        v
ARCHITECTURAL SPECIFICATION
        |
        v
GEOMETRIC RECONSTRUCTION
        |
        v
       3D MODEL
        |
        v
ORTHOGRAPHIC CAMERA VIEWS
        |
        v
2D TECHNICAL DRAWINGS
        |
        v
ANNOTATION AND DIMENSIONS
        |
        v
FINAL PRESENTATION SHEET
```

## Phase 6 — Validation

Validate all six views against the shared geometry.

Do not rely exclusively on visual similarity.

## Phase 7 — Export

Recommended output structure:

```text
architectural-output/
├── reference/
│   └── original_image.jpg
├── analysis/
│   ├── feature_inventory.json
│   ├── building_geometry.json
│   └── assumptions.md
├── views/
│   ├── front.png
│   ├── rear.png
│   ├── left.png
│   ├── right.png
│   ├── roof_plan.png
│   └── foundation_plan.png
├── presentation/
│   └── six_view_sheet.png
└── metadata/
    └── generation_metadata.json
```

---

# 12. Programmatic Architecture: Blender and Python

For higher geometric consistency, prefer a shared 3D model.

## 12.1 Blender Strategy

Use Blender to create:

- Walls.
- Roof planes.
- Chimneys.
- Windows.
- Doors.
- Extensions.
- Foundation geometry.

Use orthographic cameras for each view.

Camera configuration:

```text
Camera 01: Front
Camera 02: Rear
Camera 03: Left
Camera 04: Right
Camera 05: Top
Camera 06: Bottom
```

Set the camera type to ORTHO.

All cameras must reference the same 3D building model.

## 12.2 Orthographic Camera Orientation

Use the building coordinate system:

```text
Front camera:
View along Y axis.

Rear camera:
View along -Y axis.

Left camera:
View along X axis.

Right camera:
View along -X axis.

Top camera:
View along -Z axis.

Bottom camera:
View along +Z axis.
```

Adjust camera up vectors and rotation to keep each drawing correctly oriented.

## 12.3 Python Rendering

Use Blender Python API (`bpy`) to:

1. Create the geometry.
2. Assign materials.
3. Create six orthographic cameras.
4. Configure lighting.
5. Render each camera.
6. Export the six images.
7. Compose the presentation sheet.

Use a consistent camera scale and image resolution for corresponding views.

---

# 13. Quality Assurance Checklist

Before returning the result, verify the following.

## Reference Fidelity

- [ ] Correct target building.
- [ ] Correct architectural style.
- [ ] Correct number of floors.
- [ ] Correct main roof type.
- [ ] Correct material appearance.
- [ ] Main openings preserved.

## Geometric Consistency

- [ ] Front and rear widths agree.
- [ ] Left and right depths agree.
- [ ] Height is consistent.
- [ ] Roof geometry is consistent.
- [ ] Chimney positions agree.
- [ ] Window positions agree.
- [ ] Extensions match the footprint.

## Drawing Quality

- [ ] Exactly six views.
- [ ] Orthographic projection.
- [ ] Clear labels.
- [ ] Readable dimensions.
- [ ] Uniform visual style.
- [ ] No accidental cropping.
- [ ] No unrelated elements.

## Reliability

- [ ] Measurements have confidence labels.
- [ ] Inferred geometry is identified.
- [ ] No invented precision.
- [ ] No unsupported structural claims.
- [ ] Output format is correct.

---

# 14. Advanced Improvements

For professional-grade reconstruction, implement these capabilities.

## 14.1 Multi-Image Reconstruction

If several photographs are available:

- Identify overlapping architectural features.
- Match corresponding points.
- Estimate camera positions.
- Recover spatial relationships.
- Improve geometric reconstruction.

Possible methods:

- Structure from Motion (SfM).
- Multi-View Stereo (MVS).
- Photogrammetry.
- COLMAP.
- OpenMVG.
- OpenMVS.

## 14.2 Monocular Depth Estimation

When only one photograph is available, use a monocular depth estimation model to estimate relative depth.

Possible models:

- Depth Anything.
- MiDaS.
- ZoeDepth.

Important: Monocular depth is not automatically metric depth. It does not provide reliable real-world dimensions without additional calibration.

## 14.3 Human Correction

Provide an editing workflow allowing the user to:

- Correct dimensions.
- Move windows.
- Add missing doors.
- Modify roof geometry.
- Confirm inferred features.
- Replace materials.
- Approve the reconstructed building.

The shared geometry specification must be updated before regenerating all views.

## 14.4 CAD Export

When supported by the reconstruction pipeline, export:

- SVG.
- DXF.
- IFC.
- OBJ.
- GLB.
- Blender project files.

Image generation alone does not create a valid CAD model.

---

# 15. Final Agent Behavior

Always follow these rules:

1. Analyze before generating.
2. Identify the target building before reconstruction.
3. Build a shared architectural model.
4. Generate all requested views from consistent geometry.
5. Preserve observed architectural characteristics.
6. Infer hidden facades conservatively.
7. Clearly distinguish estimated and measured dimensions.
8. Prefer orthographic projection.
9. Do not treat image-generation output as verified architectural geometry.
10. Use programmatic rendering when geometric precision matters.
11. Use image generation when visual presentation matters.
12. Validate the six views before delivery.
13. Never claim structural or construction accuracy without adequate evidence.
14. Ask for additional photographs or measurements when they materially improve reconstruction.

## Expected Final Deliverables

A successful task should produce:

```text
1. Architectural feature inventory.
2. Shared building geometry specification.
3. Front elevation.
4. Rear elevation.
5. Left elevation.
6. Right elevation.
7. Roof plan.
8. Foundation / footprint plan.
9. Six-view presentation sheet.
10. Dimensions and uncertainty report.
11. Exported files when requested.
```

**Final success criterion:**

The six views must represent one coherent building, preserve its recognizable architectural identity, use consistent geometry, and clearly distinguish measured information from inferred reconstruction.

---

# End of Skill
