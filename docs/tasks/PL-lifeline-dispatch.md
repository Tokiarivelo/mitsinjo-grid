# PL — Courant de survie (lifeline), contrôleur de dispatch visible, éclairage selon l'intensité

**Read first:** `docs/contracts.md` · `docs/engine-spec.md` §1–3 · `docs/design/screens/` (écran concerné) ·
`docs/performance.md` (budgets 3D)
**Skills:** `/engine-change` (PL-1) · `/scene-3d` + `/designer-3d` (PL-2, PL-3) · `/ui-feature` + `/design-check` (PL-2, PL-3) ·
`/copilot-tool` (PL-4)

**Objectif.** Trois améliorations liées :

1. **Ne plus couper totalement un secteur.** Quand l'énergie manque, chaque secteur raccordé garde un
   _courant de survie_ à faible intensité (lumière, recharge téléphone, radio) au lieu de tomber à 0 kW.
2. **Montrer le « cerveau » du réseau.** Ajouter le contrôleur de dispatch (EMS + tableau de départs avec
   disjoncteurs / limiteurs par secteur) dans le plan 2D, le schéma unifilaire et la maquette 3D.
3. **Lumière ∝ intensité réelle.** Dans toutes les vues, ce qui est alimenté s'éclaire selon les kW servis par
   le moteur. Aujourd'hui, la nuit, les lampadaires brillent pareil même sur un départ coupé, et les fenêtres
   suivent un statut discret (`full` = 1, `partial` = 0.45), donc un secteur sans charge (`full`, 0 kW) brille au maximum.

Règle intouchable : **toutes les valeurs viennent de `@mitsinjo/engine`**. Le contrôleur affiché est une
représentation de la logique du moteur, pas un équipement réel piloté.

## Constat (code actuel)

| Où                                                                                  | Problème                                                                                                               |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `packages/engine/src/strategies/essential-first.ts`                                 | Cascade stricte : les paliers `medium`/`low` tombent à 0 kW dès que le palier au-dessus consomme tout.                 |
| `strategies/proportional.ts`, `balanced.ts`                                         | Pas de plancher garanti par secteur ; `balanced` sert `criticalShare` mais au prorata, sans minimum « éclairage ».     |
| `apps/web/src/features/microgrid-3d/utils/scene-palette.ts` `WINDOW_GLOW_BY_STATUS` | Lumière à 3 niveaux selon le statut, pas selon les kW servis ; `full` sans charge = lumière max.                       |
| `ui/distribution-lines.tsx` (lampes des poteaux)                                    | Lampadaires pilotés seulement par `lampGlow` (heure du jour) : allumés même si le départ est coupé.                    |
| `ui/grid-diagram.tsx` `sectorWireState`                                             | Fil binaire `flow` / `idle` / `cut` ; pas d'épaisseur/opacité selon la puissance ; disjoncteur ouvert/fermé seulement. |
| `ui/solar-array.tsx` (armoire onduleur), `ui/battery-unit.tsx`                      | Aucun tableau de dispatch / EMS visible entre le bus et les départs.                                                   |
| `features/overview/ui/grid-schematic-preview.tsx`                                   | Même logique binaire que le schéma.                                                                                    |

## Phase 1 — Moteur : courant de survie (`/engine-change`, contrat d'abord)

- [x] **PL-T1** Contrat : `SectorConfig.lifelineKw?: number` (≥ 0, plancher de survie par secteur ; défaut dans
      `constants.ts` `DEFAULT_LIFELINE_KW` : health 0.3, water 0.2, school 0.1, households 0.4, market 0.1 — **validé**) et `SimulationInput.strategyParams.lifeline?: { enabled: boolean }`
      (défaut **activé**). `SectorStep` gagne `lifelineServedKw` et `mode: 'full' | 'limited' | 'lifeline' | 'off'`.
      Mettre à jour `docs/contracts.md`.
      **Done when** schémas Zod + types exportés, hash stable quand la valeur = défaut (même règle que `balancedWeights`).
- [x] **PL-T2** Passe 0 commune aux 3 stratégies (`strategies/lifeline.ts`, appelée dans `strategies/index.ts`
      avant la stratégie choisie) : servir `min(demand_s, lifeline_s)` à **tous** les secteurs, puis passer le reste à
      la stratégie avec la demande diminuée du plancher déjà servi. Les `sectorCaps` (PY) restent prioritaires :
      plafond `< plancher` → le plafond gagne + warning.
      **Mode secours** (décision validée), quand `dispo < Σ planchers` :
      (a) eau et santé seules reçoivent du courant, à **part égale** : `min(dispo / 2, plancher_s, demand_s)` chacune ;
      si l'une est limitée par son plancher ou sa demande, le surplus va à l'autre (jusqu'à son plancher) ;
      (b) s'il reste de l'énergie une fois ces deux planchers tenus, elle va aux autres secteurs au prorata de leurs
      planchers ; sinon ces secteurs sont à 0 kW (`mode = 'off'`).
      **Done when** tests : énergie conservée, `served_s ≥ min(demand_s, lifeline_s)` quand `dispo ≥ Σ planchers`,
      `lifeline.enabled = false` → résultats et id identiques à aujourd'hui ; cas `dispo < Σ planchers` : eau et
      santé reçoivent la même puissance (à ε près) tant qu'aucune n'atteint son plancher, et les autres secteurs ne
      reçoivent rien avant que eau et santé soient à leur plancher.
- [x] **PL-T3** Invariant `LIFELINE_MET` (§3) + warning `LIFELINE_SHORTFALL` (énergie < Σ planchers) + métrique
      `lifelineCoveragePct` (part des heures-secteur où le plancher est tenu). Champ `mode` calculé par le moteur
      (`off` < 0.05 kW, `lifeline` ≤ plancher + ε, `limited` < demande, `full`). Mettre à jour `engine-spec.md` §2–4.
- [x] **PL-T4** `InputPatch` : `lifeline?: { enabled?: boolean; kw?: Partial<Record<SectorId, number>> }`
      (bornes LLM-safe 0–2 kW) + `applyPatch` + tests. Comparaison : `compare.ts` expose le gain de
      `lifelineCoveragePct` entre stratégies.

## Phase 2 — Le « cerveau » visible : contrôleur de dispatch (plan 2D, unifilaire, 3D)

Modèle de vue unique, calculé une fois et partagé par toutes les vues :

- [x] **PL-T5** `toSceneModel` ajoute `controller: { mode: 'normal' | 'rationing' | 'lifeline_only', feeders:
Record<SectorId, { mode; servedKw; intensity /* 0..1 */; breaker: 'closed' | 'limited' | 'open' }> }`.
      `intensity = servedKw / maxServedKw_s` (max du secteur sur la journée, fourni par le résultat moteur, pas
      recalculé côté UI au-delà d'une division d'affichage). `mode` contrôleur dérivé des `SectorStep.mode` moteur.
      **Done when** tests unitaires de `to-scene-model` (nuit sans soleil, batterie basse, survie seule).
- [x] **PL-T6** Plan village + schéma unifilaire (`grid-diagram.tsx`, `diagram-layout.ts`) : nouveau bloc
      **« Contrôleur EMS / tableau de départs »** entre le bus et les secteurs (onduleur-chargeur → bus DC/AC → EMS →
      un départ par secteur avec disjoncteur **+ limiteur de courant**). Symbole limiteur actif quand `breaker =
'limited'` (mode survie). Infobulle : règle appliquée (stratégie + plancher). Même composant réutilisé par
      `grid-schematic-preview.tsx` (pas de duplication).
- [x] **PL-T7** Maquette 3D (`/designer-3d` puis `/scene-3d`) : un **local technique** près de la batterie
      (`BUS_POSITION`) : armoire EMS avec écran de statut, rangée de 5 disjoncteurs/limiteurs avec voyant par
      départ (vert plein / ambre survie / rouge ouvert), câbles du tableau vers chaque départ. Ajouter le preset
      caméra `controller` et le focus au clic. Géométries instanciées / fusionnées (`merge-parts.ts`) ; budget
      draw calls de `docs/performance.md` respecté.
- [x] **PL-T8** Stitch + doc design : maquette du bloc contrôleur (plan, unifilaire, carte 3D) en dark et light,
      mobile 320 px ; `docs/design/stitch-map.md` + spec écran mis à jour. Clés i18n EN/FR/MG
      (`controller.*`, `feeder.mode.*`), `make check-i18n` vert.

## Phase 3 — Éclairage selon l'intensité, dans toutes les vues

- [ ] **PL-T9** 3D fenêtres : remplacer `WINDOW_GLOW_BY_STATUS[status]` par une courbe continue
      `glowFromIntensity(intensity)` (`scene-palette.ts`, testée) : 0 → noir, plancher de survie → faible lueur
      chaude (une ampoule), 1 → pleine lumière. Secteur sans charge ≠ plein éclairage. Multiplié par `lampGlow`
      (heure) comme aujourd'hui.
- [ ] **PL-T10** 3D lampadaires et guirlande du marché : `distribution-lines.tsx` reçoit l'intensité **du départ
      qui alimente chaque poteau** (mapping poteau → secteur dans `cable-route.ts`) ; départ coupé → lampes
      éteintes, survie → lampes atténuées. Couleur instanciée par lampe (une seule draw call conservée).
- [ ] **PL-T11** 3D flux : `electron-flow.tsx` / `flow-wire.tsx` — vitesse, densité et émissivité des particules
      ∝ kW du départ ; fil coupé gris sans particules.
- [ ] **PL-T12** 2D (plan, unifilaire, aperçu overview) : épaisseur et opacité du trait ∝ intensité, halo
      `glow` sur les bâtiments selon intensité (tokens `@theme` uniquement, pas de hex), état « survie » en ambre
      pointillé. Légende mise à jour. Carte bâtiment : `servedKw / demandKw` + badge mode (`full / limited /
lifeline / off`).
- [ ] **PL-T13** Accessibilité : l'intensité n'est jamais portée par la couleur seule (libellé de mode + valeur
      kW), contraste AA dark/light, `prefers-reduced-motion` coupe l'animation des particules.

## Phase 4 — Copilot, tests, doc

- [ ] **PL-T14** Copilot (`/copilot-tool`) : `propose_change` accepte `lifeline` ; règle de prompt « la survie est un
      choix social : montrer le coût (énergie retirée aux autres secteurs) via `compare_strategies` ». Cas d'éval :
      « Le soir, ne coupez pas le quartier, laissez au moins la lumière » → proposition de plancher, jamais appliquée seule.
- [ ] **PL-T15** E2E Playwright : chute solaire + nuit → aucun secteur en `off` tant que `Σ planchers ≤ dispo` ;
      batterie au minimum et `dispo < Σ planchers` → seules eau et santé restent éclairées, avec la même intensité ;
      attentes e2e et chiffres de la démo mis à jour (la survie, activée par défaut, change les résultats) ;
      le contrôleur affiche `rationing` ; capture `make shots` (dark/light, mobile/desktop) comparée à la maquette.
- [ ] **PL-T16** Docs : `contracts.md`, `engine-spec.md`, `copilot.md`, `docs/design/*`, `README.md` (fonctionnalité),
      ligne PL dans `docs/tasks/README.md`, `HANDOFF.md`.

## Ordre conseillé et découpage PR

1. **PR 1** = PL-T1…T4 (moteur seul, testable sans UI).
2. **PR 2** = PL-T5, T9…T13 (intensité dans toutes les vues — corrige le bug visible des lumières).
3. **PR 3** = PL-T6…T8 (contrôleur 2D + 3D, avec maquette Stitch d'abord).
4. **PR 4** = PL-T14…T16.

## Décisions validées (2026-10-29)

- Planchers par défaut : health 0.3 kW · water 0.2 · school 0.1 · households 0.4 · market 0.1.
- Survie **activée par défaut** : les chiffres de la démo changent, mettre à jour les attentes e2e et le texte de démo.
- `dispo < Σ planchers` : **mode secours** : seules eau et santé sont alimentées, à part égale ; le reste éventuel
  va aux autres planchers au prorata. Le contrôleur affiche alors `lifeline_only` et l'avertissement
  `LIFELINE_SHORTFALL` nomme les secteurs coupés.

**Exit criteria:** quand l'énergie manque, aucun secteur raccordé ne tombe à 0 kW tant que `Σ planchers ≤ dispo`, et en dessous eau + santé restent
alimentées à part égale ;
le contrôleur est visible et cohérent dans le plan, l'unifilaire et la 3D ; dans chaque vue, la lumière suit les kW
servis par le moteur (nuit + départ coupé = noir) ; i18n EN/FR/MG, dark/light, mobile OK ; `make check` + `make e2e` verts.
