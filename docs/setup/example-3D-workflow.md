# AI Architectural Reconstruction — Technical Specification

**Objectif :** reconstruire un bâtiment architectural réaliste en 3D depuis une photographie, en utilisant les modèles Meta, Blender et Three.js.

**Date de recherche :** 1 novembre 2026.

## 1. Objectif

Construire un système qui transforme une photographie en une scène 3D éditable.

Sorties :

- Building geometry JSON
- Architectural graph
- Blender project (.blend)
- 3D mesh
- Textures PBR
- GLB/glTF
- Interactive Three.js scene

La reconstruction doit distinguer les éléments observés, les éléments inférés et les éléments inconnus.

## 2. Modèles

| Modèle                 | ID                           | Responsabilité                            |
| ---------------------- | ---------------------------- | ----------------------------------------- |
| Muse Spark 1.3         | `muse-spark-1.3`             | Analyse, raisonnement, orchestration      |
| Muse Spark Contributor | `muse-spark-1.3-contributor` | Tâches courantes à moindre coût           |
| Muse Wonder            | `muse-wonder-1.0`            | Agents complexes                          |
| Muse Image             | `muse-image-1.0`             | Références et édition d'images            |
| SAM 3.1                | `sam-3.1`                    | Segmentation                              |
| VGGT / VGGT-Ω          | Recherche Meta AI            | Géométrie et reconstruction expérimentale |

Ne pas confondre les modèles disponibles sur Meta Model API et les modèles de recherche à installer séparément.

## 3. Architecture

### Perception

- Analyse de l'image avec Muse Spark.
- Détection des objets.
- Identification des matériaux.
- Extraction des caractéristiques architecturales.

### Segmentation

- SAM 3.1.
- Masques binaires.
- Bounding boxes.
- Correction des masques.
- Sauvegarde des résultats.

### Raisonnement spatial

- Coordonnées 3D.
- Dimensions.
- Relations parent-enfant.
- Graphe architectural.
- Estimation de profondeur.
- Incertitudes.

### Génération

- Blender Python.
- Volumes paramétriques.
- Toitures.
- Ouvertures.
- Cheminées.
- Détails.
- Textures PBR.

### Validation

- Rendu caméra.
- Comparaison avec la photographie.
- Erreur de silhouette.
- Erreur de reprojection.
- Correction itérative.

### Export

- GLB.
- Three.js.
- React Three Fiber.

## 4. Système de coordonnées

- X : largeur.
- Y : profondeur.
- Z : hauteur.
- Unité : mètre.
- Origine : centre au niveau du sol.

Ne jamais mélanger coordonnées image et coordonnées monde.

## 5. Approches mathématiques

### Projection perspective

p = K[R|t]P

### Calcul de pente

h = (W/2) tan(theta)

### Optimisation

theta* = argmin L(theta)

### Fonction de perte

L = a L_silhouette + b L_edges + c L_landmarks + d L_geometry

### Raisonnement bayésien

P(G|I) proportional to P(I|G)P(G)

### Contraintes

- Fenêtres dans les murs.
- Portes dans les murs.
- Cheminées sur les toitures.
- Toitures raccordées aux volumes.
- Lucarnes orientées selon les pans de toit.
- Absence d'intersections incohérentes.

## 6. Skills

1. architectural-image-analysis
2. architectural-segmentation
3. spatial-reasoning
4. camera-calibration
5. procedural-architecture
6. roof-generation
7. architectural-materials
8. architectural-validation
9. image-reprojection
10. blender-export
11. threejs-integration

Chaque Skill doit posséder des entrées, des sorties, des règles et des critères de validation.

## 7. Exemple : Cotswold Stone House

Photographie : Bourton-on-the-Water.

Objet : maison en pierre située à droite.

Composants :

- main_building
- right_gable_wing
- main_roof
- secondary_roofs
- chimneys
- dormers
- windows
- doors
- stone_facade
- gutters
- architectural_details

Matériaux :

- Calcaire jaune-beige.
- Couverture en plaques de pierre.
- Menuiseries blanches.
- Verre.
- Pierre vieillie pour les cheminées.

Les dimensions doivent être estimées et validées, jamais présentées comme des mesures réelles.

## 8. Workflow

1. Upload image.
2. Muse Spark image analysis.
3. Architectural JSON.
4. SAM 3.1 segmentation.
5. Mask processing.
6. Spatial reasoning.
7. Camera estimation.
8. Geometry specification.
9. Zod validation.
10. Blender generation.
11. Camera rendering.
12. Muse visual review.
13. Geometric correction.
14. PBR materials.
15. GLB export.
16. Three.js integration.

## 9. Organisation des fichiers

```text
project/
  input/
  analysis/
  segmentation/
  geometry/
  blender/
  renders/
  exports/
```

## 10. Ordre d'implémentation

- Sprint 1 : image analysis.
- Sprint 2 : SAM segmentation.
- Sprint 3 : architectural graph.
- Sprint 4 : basic geometry.
- Sprint 5 : roofs.
- Sprint 6 : windows and chimneys.
- Sprint 7 : PBR materials.
- Sprint 8 : reprojection.
- Sprint 9 : GLB export.
- Sprint 10 : Three.js viewer.

## 11. Règle principale

The LLM must reason about architecture.

The geometry engine must build geometry.

The validation engine must verify geometry.

The rendering engine must visualize geometry.

Never delegate the entire 3D reconstruction to a single free-form LLM response.

## 12. Documentation

- https://dev.meta.ai/docs/models
- https://dev.meta.ai/docs/image-generation
- https://dev.meta.ai/docs/sam/overview
- https://github.com/facebookresearch/vggt
- https://github.com/facebookresearch/vggt-omega
- https://www.blender.org/features/modeling/
- https://docs.blender.org/api/current/
- https://threejs.org/docs/pages/GLTFLoader.html
- https://threejs.org/docs/pages/GLTFExporter.html
