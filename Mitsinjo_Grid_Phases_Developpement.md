# Mitsinjo Grid — Phases de développement

## MVP Web, visualisation 3D et simulation logicielle

**Contexte :** développement en solo pour le Meta Global AI Developer Hackathon  
**Périmètre :** application Web, visualisation 3D et simulation énergétique logicielle  
**Hors périmètre :** électronique, IoT, capteurs physiques, matériel solaire réel et commande d'équipements

## 1. Vision du produit

Mitsinjo Grid est un copilote de simulation pour micro-réseaux solaires ruraux. L'utilisateur explore un micro-réseau dans une scène 3D, ajuste la production solaire et la demande, lance des scénarios de pénurie, puis compare plusieurs stratégies de distribution de l'énergie. Une interface conversationnelle alimentée par un modèle Meta aide à comprendre les résultats.

La 3D doit servir à expliquer la simulation, pas seulement à décorer l'application. Les valeurs affichées dans la scène et le tableau de bord doivent provenir du même moteur de simulation.

## 2. Principes de développement

- **Priorité au MVP :** terminer un parcours de démonstration complet avant d'ajouter des fonctionnalités secondaires.
- **Simulation déterministe :** les calculs énergétiques sont réalisés par du code prévisible et testé, pas par le modèle de langage.
- **3D utile :** chaque animation ou changement visuel doit refléter une valeur simulée.
- **IA comme copilote :** le modèle explique les résultats et demande des simulations via des fonctions contrôlées; il ne décide pas seul des chiffres.
- **Données synthétiques :** toute donnée inventée pour la démonstration est identifiée comme simulée.
- **Développement solo :** limiter les technologies et éviter les microservices tant qu'ils ne sont pas nécessaires.

## 2bis. Revue des phases (2026-10-26)

**Phases ou tâches manquantes ajoutées** (détail en anglais, une phase par fichier : `docs/tasks/`) :

| Manque constaté                                                                        | Où c'est traité                                                           |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Aucune phase pour le dépôt, la CI et les fichiers d'agents (`CLAUDE.md`, `HANDOFF.md`) | **P1 Dépôt et outillage**                                                 |
| Aucune phase design system (Stitch → tokens → kit UI → shell)                          | **P2 Design system**, en parallèle du moteur                              |
| Contrat de données partagé 2D / 3D / IA non figé avant le code                         | `docs/contracts.md`, tâche P3-T1                                          |
| Navigation incohérente avec le design (« À propos » vs Strategy Lab / Copilot)         | Routes alignées : `/overview /simulation /strategies /scenarios /copilot` |
| Stratégie « équilibrée » du design absente des phases                                  | P3-T9 (optionnelle)                                                       |
| Repli 2D si WebGL indisponible, réduction des animations                               | P7-T5, P7-T3                                                              |
| Validation par l'utilisateur des changements proposés par l'IA                         | P6-T6 (`propose_change` + confirmation)                                   |
| Repli déterministe si l'API Meta échoue                                                | P6-T1 / P6-T4 (fournisseur `mock`)                                        |
| Jeu d'évaluation du copilote (≥ 5 questions, dont invalides)                           | P6-T7                                                                     |
| Export du résumé de simulation (fonctionnalité MVP n° 8 du dossier)                    | P5-T4                                                                     |
| Écran Scénarios et hypothèses, provenance des données                                  | P5-T3                                                                     |
| Règles officielles, licence, vidéo, soumission                                         | P0-T2, P9                                                                 |
| Détection d'anomalies (dossier §8)                                                     | PX, optionnelle                                                           |

**Changement d'ordre :** le copilote Meta (P6) passe **avant** la 3D (P7). Le copilote n'est plus
« si le temps le permet » : c'est la fonctionnalité jugée par un hackathon Meta. Le fournisseur
`mock` garantit qu'il fonctionne même sans accès API.

**Nouvelle numérotation :** P0 Cadrage · P1 Dépôt · P2 Design · P3 Moteur · P4 2D + Strategy Lab ·
P5 Contrôles et scénarios · P6 Copilote · P7 3D · P8 Qualité · P9 Livraison · PX Anomalies.
Les sections détaillées ci-dessous gardent l'ancienne numérotation pour référence ;
**les fichiers `docs/tasks/` font foi.**

## 3. Stack recommandée

| Partie           | Choix proposé                           | Utilité                                    |
| ---------------- | --------------------------------------- | ------------------------------------------ |
| Application Web  | Next.js + TypeScript                    | Interface et logique serveur               |
| UI               | Tailwind CSS                            | Mise en page et composants                 |
| Visualisation 3D | Three.js avec React Three Fiber         | Scène 3D interactive dans React            |
| Helpers 3D       | Drei                                    | Caméra, contrôles et composants pratiques  |
| Graphiques       | Recharts ou équivalent                  | Courbes de production, batterie et demande |
| Validation       | Zod                                     | Valider les paramètres de simulation       |
| Tests unitaires  | Vitest                                  | Tester le moteur énergétique               |
| Tests navigateur | Playwright                              | Vérifier le parcours de démonstration      |
| IA               | Meta Model API, si l'accès est confirmé | Chat, explications et appels de fonctions  |
| État global      | Zustand                                 | Un seul résultat partagé par 2D, 3D et IA  |
| Monorepo         | pnpm + Turborepo                        | `apps/web` + `packages/engine`             |
| Versionnement    | Git + GitHub                            | Historique, sauvegardes et revue du code   |
| Déploiement      | Vercel ou plateforme équivalente        | Publier la démonstration                   |

**Conseil :** commence sans base de données. Les scénarios de démonstration peuvent être stockés dans des fichiers TypeScript ou JSON. Ajoute une base seulement si une fonctionnalité réellement nécessaire l'exige.

## 4. Phases de développement

### Phase 0 — Cadrage et vérification des accès

**Durée cible :** quelques heures

**Objectifs**

- Définir le scénario principal du jury.
- Vérifier l'accès à Meta Model API et ses limites.
- Créer le dépôt GitHub et le projet Next.js.
- Choisir les unités et hypothèses de simulation.

**Tâches**

- [ ] Définir le cas principal : une baisse de production solaire de 40 % pendant deux heures.
- [ ] Définir cinq secteurs : centre de santé, pompage d'eau, école, ménages, marché/artisans.
- [ ] Définir une stratégie de référence et une stratégie donnant la priorité aux services essentiels.
- [ ] Écrire les hypothèses de départ : capacité de batterie, demande, puissance solaire, rendement et pas de temps.
- [ ] Créer le dépôt, les scripts et le README initial.
- [ ] Tester une requête minimale à l'API Meta, si l'accès est disponible.

**Livrable**

- Un README avec le périmètre, les hypothèses, le scénario de démo et les commandes pour lancer le projet.

**Critère de validation**

- Le projet démarre localement et le périmètre est assez petit pour être terminé seul.

### Phase 1 — Structure Web et expérience utilisateur

**Durée cible :** 0,5 à 1 jour

**Objectifs**

- Mettre en place une interface claire avant de développer la 3D.
- Définir les composants principaux du dashboard.

**Tâches**

- [ ] Créer la page principale du dashboard.
- [ ] Ajouter une navigation simple : Dashboard, Simulation, Scénarios et À propos.
- [ ] Créer des composants pour les indicateurs : production, demande, état de batterie et énergie non servie.
- [ ] Ajouter un panneau de paramètres pour les scénarios.
- [ ] Préparer les états chargement, erreur et absence de résultat.
- [ ] Vérifier l'affichage sur ordinateur et mobile.

**Livrable**

- Une interface Web navigable avec des données de démonstration clairement identifiées.

**Critère de validation**

- Le jury peut comprendre le but du produit sans explication orale préalable.

### Phase 2 — Moteur de simulation énergétique

**Durée cible :** 1 à 1,5 jour

**Objectifs**

- Construire le cœur du produit indépendamment de l'interface et de l'IA.

**Tâches**

- [ ] Définir les types TypeScript : MicrogridConfig, SectorDemand, SimulationStep, SimulationResult et Strategy.
- [ ] Modéliser la production solaire, la demande par secteur, la batterie et les limites de puissance.
- [ ] Implémenter la stratégie de référence.
- [ ] Implémenter la stratégie priorisant les services essentiels.
- [ ] Calculer l'énergie fournie, l'énergie non servie et l'état de charge de la batterie à chaque pas de temps.
- [ ] Gérer les contraintes : énergie et charge de batterie ne doivent pas devenir négatives; la batterie ne doit pas dépasser sa capacité.
- [ ] Ajouter des tests unitaires pour les cas normaux, la pénurie et la batterie pleine ou vide.
- [ ] Créer un scénario de baisse solaire de 40 % pendant deux heures.

**Livrable**

- Un module de simulation déterministe et testable, indépendant du rendu 3D.

**Critère de validation**

- À paramètres identiques, le moteur produit les mêmes résultats; les contraintes énergétiques restent respectées.

**Note de modélisation**

- Documenter précisément les hypothèses et unités. Éviter de présenter le modèle simplifié comme un simulateur d'ingénierie certifié.

### Phase 3 — Visualisation 2D et comparaison des stratégies

**Durée cible :** 0,5 à 1 jour

**Objectifs**

- Rendre les résultats compréhensibles avant d'ajouter la 3D.

**Tâches**

- [ ] Afficher la production solaire et la demande dans un graphique temporel.
- [ ] Afficher l'état de charge de la batterie.
- [ ] Comparer l'énergie fournie et l'énergie non servie par secteur.
- [ ] Montrer les résultats des deux stratégies côte à côte.
- [ ] Ajouter un bouton pour lancer ou réinitialiser la simulation.
- [ ] Afficher les hypothèses du scénario actif.

**Livrable**

- Un tableau de bord fonctionnel qui démontre déjà la valeur du projet sans dépendre de la 3D.

**Critère de validation**

- Le scénario principal fonctionne de bout en bout et les différences entre stratégies sont visibles.

### Phase 4 — Scène 3D interactive du micro-réseau

**Durée cible :** 1 à 1,5 jour

**Objectifs**

- Créer une scène 3D claire et réactive aux résultats de simulation.

**Éléments visuels recommandés**

- [ ] Panneaux solaires stylisés.
- [ ] Batterie centrale.
- [ ] Nœud ou ligne représentant le réseau de distribution.
- [ ] Cinq bâtiments représentant les secteurs : santé, eau, école, ménages et marché.
- [ ] Caméra orbitale avec zoom et rotation.
- [ ] Légende, étiquettes et panneau d'information pour les bâtiments.

**Interactions**

- [ ] Cliquer sur un bâtiment pour afficher sa demande, l'énergie fournie et l'énergie non servie.
- [ ] Utiliser une couleur ou un indicateur visuel pour représenter le niveau de service.
- [ ] Faire varier l'intensité lumineuse ou l'animation des panneaux selon la production simulée.
- [ ] Représenter l'état de charge de la batterie par un indicateur visuel.
- [ ] Faire apparaître les secteurs affectés lorsque l'énergie manque.

**Livrable**

- Une scène 3D utilisable et reliée aux données du moteur de simulation.

**Critère de validation**

- Quand les paramètres changent, la scène 3D et les indicateurs 2D se mettent à jour à partir du même résultat de simulation.

**Limite de périmètre**

- Utiliser des modèles simples construits avec des primitives 3D. Ne pas perdre du temps à créer des modèles photoréalistes ou des animations complexes.

### Phase 5 — Contrôles de scénario et animation temporelle

**Durée cible :** 0,5 à 1 jour

**Objectifs**

- Permettre au jury de manipuler la simulation en direct.

**Tâches**

- [ ] Ajouter un curseur de production solaire.
- [ ] Ajouter un réglage de demande globale ou par secteur.
- [ ] Ajouter un contrôle de capacité ou d'état initial de la batterie.
- [ ] Ajouter des presets : journée normale, baisse solaire, forte demande.
- [ ] Ajouter lecture, pause, étape suivante et réinitialisation pour parcourir les pas de temps.
- [ ] Synchroniser l'animation 3D, les graphiques et les indicateurs.

**Livrable**

- Une simulation interactive où les modifications de paramètres sont visibles immédiatement.

**Critère de validation**

- Le scénario de pénurie peut être configuré et montré sans recharger la page.

### Phase 6 — Intégration du copilote IA Meta

**Durée cible :** 0,5 à 1 jour, après confirmation de l'accès API

**Objectifs**

- Permettre aux utilisateurs de poser des questions et de demander des simulations en langage naturel.

**Tâches**

- [ ] Créer une interface de chat.
- [ ] Définir des fonctions limitées, par exemple `runSimulation`, `compareStrategies` et `explainResults`.
- [ ] Valider les arguments de fonction côté serveur.
- [ ] Exécuter les calculs dans le moteur déterministe.
- [ ] Envoyer au modèle les résultats structurés pour qu'il les explique.
- [ ] Demander des explications qui citent les valeurs et les hypothèses fournies.
- [ ] Gérer les erreurs, limites de débit et indisponibilités de l'API.
- [ ] Empêcher l'IA de prétendre avoir des mesures réelles ou d'inventer des résultats non calculés.

**Exemples de questions**

- « Que se passe-t-il si la production solaire baisse de 40 % pendant deux heures ? »
- « Compare la stratégie de référence avec la stratégie priorisant le centre de santé et le pompage d'eau. »
- « Pourquoi le niveau de service du marché diminue-t-il dans ce scénario ? »

**Livrable**

- Un copilote qui peut lancer des simulations via des fonctions contrôlées et expliquer les résultats calculés.

**Critère de validation**

- Les chiffres affichés dans la réponse IA correspondent aux résultats du moteur. Si l'accès Meta API n'est pas disponible, garder le chat hors du chemin critique et fournir une démonstration déterministe avec explications préécrites.

### Phase 7 — Tests, performance et fiabilité

**Durée cible :** 0,5 à 1 jour

**Tâches**

- [ ] Tester le moteur sur plusieurs scénarios.
- [ ] Vérifier les limites de batterie et les bilans énergétiques.
- [ ] Tester les contrôles du dashboard et de la scène 3D.
- [ ] Tester le parcours principal avec Playwright.
- [ ] Vérifier la gestion d'une erreur API ou d'une absence de connexion.
- [ ] Tester la scène 3D sur un ordinateur moyen.
- [ ] Réduire le nombre de polygones et d'effets si le rendu est lent.
- [ ] Vérifier les contrastes, les libellés et les unités.
- [ ] Ajouter une option de réduction ou de désactivation des animations.

**Livrable**

- Un MVP stable et une liste claire de limites connues.

### Phase 8 — Déploiement et préparation de la démo

**Durée cible :** 0,5 jour

**Tâches**

- [ ] Déployer l'application.
- [ ] Configurer les variables d'environnement côté plateforme.
- [ ] Vérifier que les secrets ne sont pas présents dans le dépôt.
- [ ] Exécuter le scénario de démonstration sur l'URL publique.
- [ ] Préparer une courte vidéo de secours.
- [ ] Mettre à jour le README avec installation, architecture, hypothèses, tests et déploiement.
- [ ] Préparer une présentation de 2 à 3 minutes.

**Livrable**

- Une application en ligne, une vidéo de secours et un parcours de démo répétable.

## 5. Parcours de démonstration conseillé

1. Ouvrir la scène 3D et présenter les panneaux solaires, la batterie et les secteurs.
2. Montrer l'état de référence : production, demande et batterie.
3. Réduire la production solaire de 40 % pendant deux heures.
4. Lancer la stratégie de référence et observer les secteurs affectés.
5. Lancer la stratégie priorisant les services essentiels.
6. Comparer les résultats dans les graphiques et dans la scène 3D.
7. Demander au copilote IA d'expliquer les compromis, si l'API est disponible.
8. Conclure avec les indicateurs mesurés par la simulation et les limites du modèle.

## 6. Structure de dossiers retenue

Voir `docs/architecture.md` (arborescence complète) et le dossier projet §14. En résumé :
`apps/web` (Next.js, features `overview`, `simulation`, `microgrid-3d`, `strategy-lab`, `scenarios`,
`copilot`) + `packages/engine` (moteur TS pur, schémas Zod, scénarios). Pas de dossier vide créé à l'avance.

## 7. Priorités si le temps manque

### À terminer absolument

1. Moteur de simulation déterministe.
2. Comparaison des deux stratégies.
3. Dashboard 2D avec indicateurs et graphiques.
4. Copilote Meta avec appels d'outils contrôlés et repli `mock`.
5. Scène 3D simple reliée aux résultats.
6. Scénario de démonstration reproductible.
7. README et déploiement.

### À terminer si le temps le permet

- Stratégie équilibrée.
- Animation temporelle avancée.
- Scénarios supplémentaires.
- Sauvegarde des simulations.
- Modèles 3D plus détaillés.

### À reporter après le hackathon

- Électronique et IoT.
- Contrôle d'équipements réels.
- Application mobile native.
- Comptes utilisateurs et gestion complexe des rôles.
- Microservices et infrastructure élaborée.
- Modèles 3D photoréalistes.

## 8. Définition de « terminé »

Le MVP est prêt quand :

- [ ] Un utilisateur peut lancer le scénario de baisse solaire.
- [ ] Les deux stratégies produisent des résultats comparables et reproductibles.
- [ ] Les graphiques 2D et la scène 3D affichent les mêmes données.
- [ ] Les secteurs affectés sont identifiables visuellement.
- [ ] Le copilote explique les résultats sans inventer de valeurs, si l'API est disponible.
- [ ] Les tests essentiels passent.
- [ ] La démo fonctionne sur une URL publique.
- [ ] Le README documente le lancement et les limites de la simulation.

## 9. Documentation utile

- Next.js : https://nextjs.org/docs
- React Three Fiber : https://r3f.docs.pmnd.rs/
- Three.js : https://threejs.org/docs/
- Drei : https://github.com/pmndrs/drei
- Vitest : https://vitest.dev/
- Playwright : https://playwright.dev/docs/intro
- GitHub : https://docs.github.com/
- Meta AI Developer : https://dev.meta.ai/docs/

---

**Recommandation finale :** en travaillant seul, vise d'abord un simulateur énergétique fiable avec un dashboard clair. Ajoute ensuite une scène 3D stylisée, puis l'IA Meta si l'accès est prêt. Une simulation simple, cohérente et démontrable vaut mieux qu'une grande scène 3D spectaculaire mais déconnectée des calculs.
