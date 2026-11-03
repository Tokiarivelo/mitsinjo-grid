# PI — Objet 3D inséré en harmonie avec le village (clairière, sol rouge, poteaux vers sa ramification)

**Read first:** `docs/contracts.md` (Appliance, `position`) · `docs/tasks/PV-free-placement.md` (PP-T1…T8, base de ce plan) ·
`docs/performance.md` (budgets 3D) · `apps/web/src/features/microgrid-3d/utils/{landscape,placement,scatter,terrain-colors,cable-route,site-positions}.ts`
**Skills:** `/scene-3d` (rendu, budgets) · `/designer-3d` (revue harmonie) · `/ui-feature` + `/design-check` (choix du raccordement) ·
pas de `/engine-change` (D1 validée : aucun nouveau départ)
**Depends on:** PA (`PA-ai-dispatch.md`) terminé et fusionné : PA-4 touche `microgrid-3d` (zones en alerte), on passe après pour éviter les conflits.
**Status:** ✅ completed (2026-11-03). Décisions D1–D3 validées (user, 2026-11-03).

**Objectif (user, 2026-11-03).** Quand on insère un objet dans la simulation, son **modèle 3D** apparaît dans le village
à sa position et s'y fond : **les arbres disparaissent autour**, **le sol devient rouge** (latérite, comme les cours des
autres bâtiments) et des **poteaux électriques** le relient à **sa ramification** (la ligne de son départ) ou au **Dispatch EMS**.

## État de départ (vérifié dans le code, 2026-11-03)

- Insérer = une ligne `Appliance` (charge) avec `position?: {x, z}` (PP-T1). Dans la scène : un **marqueur** (petite
  icône) + un **fil droit** vers le bâtiment du secteur (`appliance-markers.ts`, `feeder`). Le modèle 3D n'y est pas :
  il vit seulement dans le cache mémoire de `use-object-shape.ts` (perdu au rechargement).
- Végétation : `scatterVegetation` (déterministe, une fois) évite `KEEP_OUT_ZONES`, une liste **statique** (6 bâtiments,
  champ PV, batterie, EMS, mare). Sol : `terrainColor` peint les cours en `GROUND_HEX.yard` autour des mêmes zones
  statiques, calculé une fois dans la géométrie du terrain.
- Poteaux : `routeCable(from, to)` (portées de 4,5, flèche) pour les lignes tronc et les 6 départs ; `mapPolesToSectors`
  donne à chaque poteau son départ (éclairage public, PL-T10). Le Dispatch EMS est à `BUS_POSITION` ([0, 0, 1]).

## Règles du plan (pour éviter les erreurs)

1. **Visuel seulement.** Rien ne change dans `@mitsinjo/engine` : même charge, même départ, même hash de
   résultat. Un test le vérifie à chaque étape (résultat identique avec / sans modèle 3D).
2. **Une source de vérité pour « où l'on ne peut pas mettre » :** une fonction pure `siteZones(placed)` = zones statiques +
   emprises des objets placés. Végétation, sol, placement et poteaux lisent **toutes** cette fonction (aucune liste en double).
3. **Petites étapes, chacune livrable seule**, testée, derrière le rendu actuel : si une étape casse, le marqueur actuel reste.
4. **Recalcul au relâchement, jamais par image** (comme PP-T5) : déplacement = fantôme, commit au `pointerup`.
5. **Budgets** (`docs/performance.md`) : ≤ +3 draw calls pour 30 objets (modèles fusionnés par matériau, sol et poteaux instanciés).
6. Retirer l'objet = tout revient (arbres, sol vert, poteaux supprimés). Annulable avec le flux existant.

## Décisions (validées par l'utilisateur, 2026-11-03)

- **D1 Raccordement au Dispatch EMS — validé : a).** Ligne directe EMS → objet, **visuelle** : la charge reste comptée sur
  le départ choisi (`sector`), l'étiquette le dit (« alimenté par : Pompage d'eau, ligne directe depuis l'EMS »).
  Écarté : un vrai nouveau départ « direct EMS » (changement moteur : `SECTOR_IDS`, stratégies, i18n, hash).
- **D2 Arbres — validé.** Supprimés dans la clairière (pas déplacés) : déterministe, sans coût de recalcul global.
- **D3 Sauvegarde du modèle — validé.** Local d'abord (`localStorage`, par id d'appareil) ; Neon plus tard = migration.

## Tâches

### I0 Le modèle 3D suit l'objet dans la simulation

- [x] **PI-T1 Contrat « modèle placé ».** Type web (pas moteur) `PlacedModel { applianceId, recipe: ObjectRecipe, yaw, scale }`
      dans un petit store visuel (`placed-models.store.ts`), rempli par « Insérer dans la simulation » quand l'objet a un
      modèle prêt ; retiré avec l'appareil. Sauvegarde locale (D3) avec `try/catch`. Taille réelle : `sceneScale(archetype,
proportions)` (une maison ≈ une maison du village, un frigo ≈ 1 m) ; `footprint(recipe, scale, yaw)` → rayon + boîte.
      **Done:** `placed-models.store.ts` (Zod schema, CRUD, localStorage try/catch, `sceneScale`, `footprint`), wired to `ApplianceInsert` and `useSimulationAppliances`, 12/12 unit tests + engine invariance confirmed, `docs/contracts.md` updated.
- [x] **PI-T2 Afficher le modèle à sa place.** Réutiliser le constructeur de géométrie de `vision-insert` (pas de copie),
      posé sur `terrainHeight` (le point le plus bas de l'emprise, socle si pente), ombres comme les maisons, même palette
      de scène et mêmes réglages de matériaux (`scene-palette.ts`), états du départ (éteint si délesté, feu si secteur en feu).
      Sans modèle → le marqueur actuel. Fusion par matériau, LOD simple (boîte colorée au loin / tier `low`).
      **Done:** `buildPlacedModelsGeometry` (`placed-models-geometry.ts`), integration in `ApplianceMarkers` (`appliance-markers.tsx`) and `village-canvas.tsx`, 30 objects merged into 1 mesh (budget ≤ +2 draw calls satisfied), unit + UI tests 16/16 green.

### I1 Clairière et sol rouge

- [x] **PI-T3 Zones dynamiques.** `siteZones(placed)` (pure, testée) = `KEEP_OUT_ZONES` + un cercle par objet (rayon =
      emprise + marge par archétype). `isBlocked`, `snapAwayFromBuildings` et la mini-carte la lisent : un objet ne peut
      plus être posé sur un bâtiment, un chemin, la mare ou un autre objet placé (poussé vers le bord libre le plus proche).
      **Done when:** tests de collision (bâtiment, chemin, mare, deux objets) ; les positions des 6 bâtiments ne bougent pas.
      **Done:** `site-zones.ts` (`siteZones(placed)`, `placedItemZone`, `ARCHETYPE_CLEARING_MARGIN`), wired to `landscape.ts` (`isBlocked`), `placement.ts` (`snapAwayFromBuildings` respecting dynamic zones, paths and cross-relaxations), `place-minimap.tsx` (visual obstacles and blocked cursor), and `appliance-markers.ts`. 9/9 unit tests passing with full collision coverage (bâtiment, chemin, mare, deux objets) and 6 building positions invariance verified.
- [x] **PI-T4 Les arbres disparaissent autour.** La végétation est filtrée par `siteZones` : les instances dans une clairière
      sont masquées (échelle 0 dans l'`InstancedMesh`, sans regénérer la forêt ; D2). Recalcul au commit seulement.
      **Done when:** test pur (aucun arbre / buisson / rocher dans la zone, le reste inchangé et à la même place) ;
      retirer l'objet → les arbres reviennent ; aucune image saccadée au glisser (fantôme seulement).
      **Done:** `dynamicPlacedZones` in `site-zones.ts`, `isPositionInClearing`, `clearingItemScale`, and `applyClearingScales` in `scatter.ts`, wired to `Vegetation` and `PartInstances` in `vegetation.tsx` and `village-canvas.tsx`. 4/4 pure unit tests passing in `vegetation-clearing.test.ts`.
- [x] **PI-T5 Le sol devient rouge.** Une cour en latérite sous chaque objet, **même couleur et même bord irrégulier** que les
      cours existantes (`GROUND_HEX.yard`, bruit `fbm2d`) : disque drapé sur le relief (+3 cm, pas de z-fighting), instancié,
      au lieu de recalculer les couleurs de tout le terrain. Taille = zone de PI-T3.
      **Done when:** test de la fonction de couleur (même teinte que `terrainColor` dans une cour) ; capture /village avant /
      après ; +1 draw call au plus.
      **Done:** `buildPlacedYardsGeometry` and `buildSingleYardGeometry` in `placed-yards-geometry.ts` (draped at `terrainHeight + 0.03`, `fbm2d` irregular border, `GROUND_HEX.yard`), rendered via `<PlacedYards />` in `village-canvas.tsx` into 1 merged draw call (≤ +1 draw call budget). 4/4 unit tests passing in `placed-yards.test.ts`.

### I2 Poteaux vers sa ramification ou le Dispatch EMS

- [x] **PI-T6 Point de raccordement (pur, testé).** `tapPoint(position, sector, mode)` : mode `branch` (par défaut) = le
      **poteau le plus proche de la ligne de son départ** (`routeCable` du départ, via `mapPolesToSectors`) ou le bâtiment du
      secteur s'il est plus près ; mode `ems` (D1) = le Dispatch EMS (`BUS_POSITION`). Jamais à travers un bâtiment, la mare ou
      un autre objet : la ligne contourne (un poteau d'angle) ou change de point de raccordement.
      **Done when:** tests (branche la plus proche, EMS, contournement, objet collé au bâtiment = pas de poteau).
      **Done:** `tapPoint(position, sector, mode, options)` in `tap-point.ts`, handling branch (nearest pole or building), EMS (`BUS_POSITION`), obstacle detection via `segmentIntersectsObstacle` and contouring with corner pole waypoints (`contourWaypoint`), and zero intermediate poles when object is collé au bâtiment (distance ≤ 4.5). 10/10 unit tests passing in `tap-point.test.ts`.
- [x] **PI-T7 Poteaux et câbles.** La dérivation réutilise `routeCable` (mêmes poteaux, même flèche, même hauteur) depuis le
      point de PI-T6 jusqu'à l'objet ; poteaux instanciés avec ceux du réseau, ajoutés à `mapPolesToSectors` avec le `sector`
      de l'objet (éclairage public et couleur de départ suivent : délesté = éteint, feu = coupé). Le fil droit actuel disparaît.
      Les électrons (`electron-flow`) suivent la dérivation quand l'objet consomme.
      **Done when:** test (poteaux tous les ≤ 4,5, rattachés au bon départ) ; budgets tenus ; capture jour / nuit.
      **Done:** `buildApplianceDerivations` in `tap-point.ts`, integrated into `toSceneModel`, `DistributionLines`, `ElectronFlow`, and `mapPolesToSectors`. Catenary cables with sag, intermediate poles spaced ≤ 4.5 attributed to the appliance sector with street lamp lighting following feeder status, straight wire removed (`showStraightFeederLinks: false`), and electrons traveling along active derivations. 17/17 tests passing across `appliance-derivations.test.ts` and `appliance-markers-ui.test.tsx`.
- [x] **PI-T8 Choix du raccordement dans l'interface.** Dans le formulaire d'insertion : « Raccordement : sur sa ramification
      (recommandé) · direct au Dispatch EMS » + rappel du départ qui porte la charge (D1). i18n en / fr / mg, thème clair /
      sombre, ≥ 44 px, 320 px. Le glisser 3D (PP-T5) recalcule clairière, sol et poteaux au relâchement.
      **Done when:** tests composant ; `/design-check` ; le copilote ne décrit que le départ, jamais des coordonnées (PP-T7).
      **Done:** `connectionMode: 'branch' | 'ems'` added to `PlacedModelSchema`, `ApplianceDraft`, and `useApplianceDraft`. Connection selector wired to `ApplianceInsertPanel` with accessible toggle buttons (`role="group"`, `aria-pressed`, `min-h-11`), D1 sector attribution reminder, 100% key parity across `en.json`, `fr.json`, `mg.json`. 17/17 tests passing in `appliance-insert.test.tsx` and `appliance-draft.test.ts`.

### I3 Fin

- [x] **PI-T9 Schéma 2D et mini-carte.** L'objet placé et sa dérivation apparaissent sur la mini-carte (PP-T4) et le schéma 2D
      (une branche sur la ligne du départ, ou depuis l'EMS en mode `ems`).
      **Done:** `applianceBranchRoute` in `diagram-layout.ts` renders 2D derivation branches and terminal nodes in `GridDiagram` (`topology` and `circuit` views) with electron flow matching appliance active status or cut markers on fire. `PlaceMinimap` renders the Dispatch EMS shelter at `[0, 0, 1]` and draws derivation paths, tap dots, intermediate utility poles, and obstacle-avoidance corner waypoints matching 3D geometry. 27/27 tests green in `grid-diagram.test.tsx` and `place-minimap.test.tsx`.
- [x] **PI-T10 Passe qualité.** `/designer-3d` sur des captures (maison, voiture, frigo, panneau, à côté des bâtiments et sur
      une pente) : l'objet doit se lire « du village » (échelle, palette, ombres, cour, poteaux). `/perf-audit` (fps, draw calls),
      `make shots`, scénarios manuels (`06-village.md`, `02-simulation.md`), README (fonctionnalités), `contracts.md`,
      `docs/design/screens/village.md`.
      **Done:** `make shots` validated across all routes (`overview`, `simulation`, `strategies`, `scenarios`, `copilot`); manual scenarios V163..V165 added to `06-village.md` and S101 to `02-simulation.md`; `README.md` features updated; `docs/contracts.md` and `docs/design/screens/village.md` documented. 3D fluidity budgets strictly respected (≤ +3 draw calls, zero per-frame recalculations). Exit criteria fully satisfied.

## Risques connus et parades

| Risque                                                          | Parade                                                                 |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Listes d'exclusion en double qui divergent (arbres ici, sol là) | Une seule fonction `siteZones` (règle 2), tests croisés                |
| Recalcul lourd au glisser (forêt de 2 000 arbres, terrain)      | Masquage d'instances + disque drapé, commit au relâchement (règle 4)   |
| Objet géant ou minuscule à côté des maisons                     | `sceneScale` par archétype, bornes min / max, revue `/designer-3d`     |
| Objet sur une pente qui flotte ou s'enfonce                     | Hauteur = point le plus bas de l'emprise + socle                       |
| Poteau dans un bâtiment ou câble à travers un toit              | `tapPoint` évite `siteZones`, poteau d'angle (PI-T6)                   |
| Cycle d'import (vu en PP-T3)                                    | Nouveaux helpers en modules feuilles, pas d'import de `to-scene-model` |
| Conflit avec PA-4 (zones en alerte dans la même scène)          | Commencer après la fusion de PA (Depends on)                           |
| L'utilisateur croit que l'EMS direct change la simulation       | D1 : étiquette « charge comptée sur : <départ> »                       |

## Exit criteria

Un objet inséré avec son modèle 3D apparaît à sa place, à la bonne échelle, dans une clairière sans arbres, sur une cour
en latérite comme les autres bâtiments, relié par des poteaux à sa ramification (ou au Dispatch EMS). Le retirer remet le
village comme avant. Les résultats moteur ne changent pas, les budgets 3D sont tenus, tests et `make check` verts.
