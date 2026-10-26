# Mitsinjo Grid

## Dossier de conception détaillé --- Meta Global AI Developer Hackathon 2026

**Titre court :** Mitsinjo Grid --- The AI Copilot for Rural Microgrids\
**Type de projet :** copilote IA d'aide à la décision pour mini-réseaux
électriques solaires\
**Contexte de démonstration :** village rural fictif inspiré de
contraintes possibles à Madagascar\
**Périmètre :** prototype fonctionnel avec jumeau numérique,
optimisation déterministe et agent conversationnel\
**Durée cible :** 10 jours de développement\
**Statut :** proposition de conception à valider et adapter aux
conditions officielles du hackathon

---

## 1. Résumé exécutif

Mitsinjo Grid est un copilote d'aide à la décision conçu pour les
opérateurs de mini-réseaux solaires qui doivent gérer une quantité
d'énergie limitée. Lorsque la production photovoltaïque diminue ou que
la batterie approche de son seuil de réserve, le système simule
plusieurs stratégies de répartition, protège les services essentiels et
explique les compromis en langage naturel.

Le projet associe trois éléments complémentaires :

1.  **Un jumeau numérique de mini-réseau** qui simule la production
    solaire, la batterie et la consommation de plusieurs secteurs.
2.  **Un moteur déterministe d'optimisation** qui calcule des décisions
    selon des contraintes et priorités explicites.
3.  **Un agent conversationnel utilisant un modèle Meta disponible dans
    le cadre du hackathon** qui permet à l'opérateur de poser des
    questions, lancer des simulations contrôlées et comprendre les
    résultats.

Le modèle de langage ne pilote pas directement des équipements
électriques. Il interprète les demandes, appelle des outils applicatifs
autorisés et explique les résultats calculés par le moteur. Toutes les
données simulées sont identifiées comme telles.

### Proposition de valeur

**Aider un opérateur de mini-réseau à comprendre les conséquences d'une
pénurie d'énergie et à comparer des décisions transparentes, plutôt que
de s'appuyer sur une répartition opaque ou improvisée.**

### Objectif du prototype

En dix jours, démontrer un réseau fictif comportant cinq secteurs, un
scénario de baisse de production solaire, une stratégie de référence,
une stratégie optimisée et un chat qui explique et compare les
résultats. Le prototype n'est pas destiné à contrôler un réseau
électrique réel.

---

## 2. Problème et opportunité

Un mini-réseau isolé peut être confronté à des variations de production
solaire, à une capacité de batterie limitée, à des données de
consommation imparfaites et à des besoins qui n'ont pas tous la même
criticité. En situation de déficit, une décision de délestage peut
affecter différemment une clinique, une école, un marché ou une pompe à
eau.

Le problème visé n'est pas simplement de prédire la production. Il est
de **prendre une décision compréhensible sous contrainte**, tout en
rendant visibles les conséquences de cette décision.

### Utilisateurs cibles

- **Opérateur de mini-réseau :** surveille la production, les réserves
  et les alertes ; compare les scénarios avant de choisir une action.
- **Responsable d'un service essentiel :** cherche à comprendre les
  risques et les périodes de réduction d'alimentation.
- **Gestionnaire de projet énergétique :** compare des stratégies,
  suit des indicateurs et prépare des décisions d'exploitation.

Ces profils sont des hypothèses de conception. Le prototype doit être
testé avec des utilisateurs réels avant toute affirmation sur son
adéquation au terrain.

### Ce que le produit ne prétend pas faire

- Il ne diagnostique pas automatiquement la fraude et ne désigne aucun
  individu comme coupable.
- Il ne remplace pas un système industriel de protection électrique.
- Il ne commande pas de matériel réel dans le cadre du MVP.
- Il ne garantit pas une économie d'énergie ou une amélioration de
  service avant qu'une évaluation mesurée ne le démontre.
- Il ne présente pas des données synthétiques comme des données
  réelles.

---

## 3. Concept produit

### 3.1 Expérience principale

L'opérateur ouvre un tableau de bord qui présente l'état simulé du
mini-réseau : production solaire, état de charge de la batterie,
consommation totale, demande estimée et état des cinq secteurs.

Il sélectionne ensuite un scénario --- par exemple une baisse de 40 % de
la production solaire --- ou le demande dans le chat. Le moteur simule
la situation, compare les stratégies et retourne des résultats
structurés. L'agent explique ensuite les conséquences, les raisons des
priorités et les compromis.

### 3.2 Exemple de dialogue

**Opérateur :** « Simule une baisse de 40 % de la production solaire
pendant deux heures. »

**Agent :** « Je vais lancer une simulation. Les résultats seront
calculés par le moteur du réseau, puis je te présenterai les
conséquences. »

**Résultat du moteur :** - Production solaire réduite de 40 % pendant
deux heures. - Réserve de batterie projetée sous le seuil de confort si
toutes les charges restent alimentées. - Stratégie A : répartition
proportionnelle. - Stratégie B : priorités aux services essentiels et
réduction des charges flexibles.

**Agent :** « Dans ce scénario simulé, la stratégie B préserve mieux les
besoins prioritaires, mais réduit davantage l'énergie disponible pour
les charges flexibles. Voici les chiffres et les hypothèses utilisés. »

Les valeurs numériques finales doivent provenir du moteur de simulation,
et non être inventées par le modèle de langage.

### 3.3 Fonctionnalités du MVP

1.  Tableau de bord de l'état du mini-réseau.
2.  Simulation de production solaire et de batterie sur une période
    courte.
3.  Modélisation de cinq secteurs avec demande et criticité.
4.  Comparaison entre stratégie de référence et stratégie optimisée.
5.  Agent conversationnel avec appels d'outils contrôlés.
6.  Explications traçables qui citent les mesures et hypothèses
    utilisées.
7.  Scénarios reproductibles pour la démonstration.
8.  Export ou affichage d'un résumé de simulation.

### 3.4 Fonctionnalités reportées

À ne pas développer avant que le parcours principal soit stable : -
détection avancée de fraude ; - apprentissage de profils de consommation
à partir de longues séries historiques ; - commande de compteurs,
onduleurs ou batteries réels ; - transactions, partage commercial ou
vente d'énergie ; - inspection visuelle de panneaux par ordinateur ; -
application mobile native et gestion complète de plusieurs villages.

---

## 4. Scénario d'usage et démonstration

### Scénario central : baisse soudaine de production

**Situation initiale :** journée ensoleillée, batterie chargée à un
niveau sûr, demande répartie entre cinq secteurs.

**Événement :** un épisode nuageux simulé entraîne une baisse de 40 % de
la production pendant deux heures.

**Décision :** le moteur compare une stratégie proportionnelle à une
stratégie qui tient compte des priorités et des limites de batterie.

**Explication :** l'agent décrit ce qui change, pourquoi certaines
charges sont réduites et quelles hypothèses influencent le résultat.

**Mesure :** l'interface affiche, pour chaque stratégie, l'énergie
livrée, l'énergie non servie, l'état de charge final de la batterie et
le service des charges critiques.

### Les cinq secteurs simulés

---

Secteur Exemple de Priorité illustrative Comportement
charge

---

Santé Éclairage Très élevée Demande critique
essentiel et à préserver
chaîne du froid  
simulée

Eau Pompe de pompage Élevée Charge flexible
dans certaines
plages

École Éclairage et Moyenne Peut être
équipements réduite hors
heures
d'activité

Habitations Éclairage et Moyenne Profil variable
appareils usuels selon l'heure

Marché / Petits Variable Peut accepter
artisanat équipements et une réduction
activités planifiée
commerciales
------------------------------------------------------------------------

Les priorités sont des paramètres de démonstration, non des
prescriptions universelles. Elles devront être discutées avec les
communautés et opérateurs concernés avant toute utilisation réelle.

### Scénarios secondaires

- **Batterie faible au coucher du soleil :** comparer les conséquences
  d'une réserve plus élevée.
- **Hausse inhabituelle de consommation :** signaler une anomalie à
  vérifier sans conclure à une fraude.
- **Pompage planifié :** déplacer une charge flexible vers une période
  de surplus solaire.
- **Comparaison d'équité :** mettre en regard une stratégie priorisant
  les services essentiels et une stratégie répartissant les réductions
  plus uniformément.

---

## 5. Architecture fonctionnelle

```text
                 ┌─────────────────────────────┐
                 │ Interface Next.js           │
                 │ Dashboard + scénarios + chat│
                 └──────────────┬──────────────┘
                                │ API
                 ┌──────────────▼──────────────┐
                 │ API applicative             │
                 │ Validation + orchestration  │
                 └───────┬─────────────┬───────┘
                         │             │
          ┌──────────────▼───┐   ┌─────▼────────────────┐
          │ Moteur du réseau │   │ Agent IA Meta        │
          │ Simulation       │◄──│ Dialogue + tool calls│
          │ Optimisation     │   │ Explications         │
          │ Métriques        │──►│ Ne pilote pas le     │
          └──────────┬───────┘   │ matériel électrique  │
                     │           └──────────────────────┘
          ┌──────────▼──────────┐
          │ Scénarios et données│
          │ synthétiques + météo│
          └─────────────────────┘
```

### Principes d'architecture

- Le moteur de simulation est indépendant du fournisseur de modèle.
- Les entrées sont validées côté serveur.
- Les outils exposés à l'agent ont des paramètres typés et des
  permissions explicites.
- L'agent ne peut appeler que des fonctions autorisées, telles que
  `get_grid_state`, `run_scenario`, `compare_strategies`,
  `get_sector_metrics` et `propose_change`.
- Les décisions et métriques proviennent du moteur ; le modèle ne
  fabrique pas de chiffres.
- Les simulations sont reproductibles grâce à des paramètres et
  graines aléatoires enregistrés.
- Les journaux excluent les secrets et ne collectent pas de données
  personnelles inutiles.

### Architecture technique retenue

**Choix : monorepo léger pnpm + Turborepo, une application et un paquet pur.**
Basé sur Turborepo, Next.js App Router et une architecture par features
(« pages = imports seulement »), allégé pour un développement solo de dix jours.

| Option                                       | Décision         | Raison                                                                                                |
| -------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| Un seul projet Next.js, moteur dans `lib/`   | Repli acceptable | Le plus rapide, mais le moteur peut dépendre de React                                                 |
| **`apps/web` + `packages/engine`**           | **Retenu**       | Isolation du moteur garantie, tests indépendants, même code côté client et serveur                    |
| Next.js + NestJS + Python                    | Écarté           | Trois environnements, contrats JSON, déploiement plus lourd, sans gain prouvé                         |
| Paquets `ai-agent` et `shared-types` séparés | Fusionnés        | Un seul consommateur chacun : agent dans `apps/web/src/server/copilot`, types = schémas Zod du moteur |

**Flux de données :**

- Le moteur s'exécute **dans le navigateur** (< 10 ms) : les curseurs mettent à jour le tableau de bord,
  les graphiques et la scène 3D instantanément, à partir d'un **unique résultat** stocké dans Zustand.
- Le copilote appelle `POST /api/copilot` ; le serveur **recalcule** avec le même moteur
  (il ne fait jamais confiance aux chiffres envoyés par le client), puis renvoie un flux SSE :
  activité des outils, texte, **preuves calculées** (`resultId` + valeurs) et éventuelle proposition.
- Une proposition de l'IA n'est **jamais appliquée automatiquement** : l'utilisateur la confirme.
- Un fournisseur `mock` déterministe remplace le modèle Meta si l'API est indisponible.

Pas de base de données, pas de service Python, pas d'API séparée pour le MVP.
Détails : `docs/architecture.md`, contrats : `docs/contracts.md`.

---

## 6. Simulation et optimisation

### 6.1 Variables de simulation

Le modèle de départ peut fonctionner par pas de 15 minutes ou d'une
heure. Pour un MVP, un pas horaire est plus facile à valider ; un pas de
15 minutes peut être ajouté si le temps le permet.

Variables minimales : - production solaire disponible ; - capacité et
état de charge de la batterie ; - puissance maximale de charge et de
décharge ; - consommation demandée par secteur ; - puissance minimale ou
charge critique par secteur ; - pertes simplifiées ; - seuil minimal de
réserve de batterie.

### 6.2 Bilan énergétique simplifié

À chaque pas de temps :

`énergie disponible = production solaire + énergie de décharge autorisée`

`énergie demandée = somme des demandes des secteurs`

Le moteur calcule la quantité livrée à chaque secteur sans dépasser les
limites de puissance et d'énergie. Le modèle de batterie doit empêcher
un état de charge supérieur à sa capacité ou inférieur à sa réserve
minimale. Le surplus solaire peut charger la batterie dans la limite de
sa puissance de charge.

Ce bilan est volontairement simplifié. Il ne remplace pas une simulation
électrique de niveau industriel et ne modélise pas tous les phénomènes
d'un réseau réel.

### 6.3 Stratégies à comparer

**Stratégie de référence :** répartir le déficit proportionnellement à
la demande, sous réserve des limites physiques simplifiées.

**Stratégie priorisée :** préserver d'abord les charges critiques
configurées, puis répartir l'énergie restante entre les charges
flexibles selon des règles explicites.

**Option d'optimisation :** minimiser une fonction de coût pondérée, par
exemple :

`coût = pénalité_critique × énergie_critique_non_servie + pénalité_autres × énergie_non_servie + pénalité_batterie × réserve_utilisée`

Les poids doivent être documentés et testés. Une pondération ne doit pas
être présentée comme objectivement juste sans validation des parties
concernées.

### 6.4 Métriques de comparaison

- énergie totale demandée et livrée ;
- énergie non servie par secteur ;
- énergie non servie aux charges critiques ;
- état de charge initial et final de la batterie ;
- durée pendant laquelle une charge critique n'est pas satisfaite ;
- nombre de violations de contraintes (la cible est zéro) ;
- résultat par stratégie et hypothèses utilisées.

Le tableau de bord doit montrer les résultats de la simulation et les
hypothèses, pas seulement un score synthétique.

---

## 7. Agent conversationnel et intégration Meta

### Rôle de l'agent

L'agent rend le système accessible. Il traduit les demandes en appels
d'outils limités, récupère les résultats structurés, puis explique les
conséquences et les incertitudes.

Il ne doit pas : - inventer des mesures ; - modifier directement les
règles d'optimisation sans validation ; - interpréter une anomalie comme
une preuve de fraude ; - exécuter une action physique ; - ignorer une
contrainte de sécurité parce que l'utilisateur le demande.

### Outils applicatifs proposés

---

Outil Fonction Garde-fou

---

`get_grid_state` Retourne l'état courant Lecture seule
de la simulation

`run_scenario` Lance un scénario nommé Limites de paramètres
avec paramètres validés et simulation
uniquement

`compare_strategies` Compare les résultats Retourne les métriques
des stratégies calculées
disponibles

`get_sector_metrics` Donne les mesures d'un Ne retourne que les
secteur champs autorisés

`propose_change` Propose une Jamais appliqué sans
modification de confirmation explicite
scénario de l'utilisateur
-----------------------------------------------------------------------

Les noms sont des propositions de conception. Ils devront être adaptés
au format exact d'appel d'outils supporté par le modèle et l'API
retenus.

### Intégration Meta : étapes

1.  Vérifier l'accès réel au modèle et à l'API mis à disposition des
    participants.
2.  Construire un appel simple qui reçoit une question et retourne une
    réponse.
3.  Ajouter un outil en lecture seule pour obtenir l'état de la
    simulation.
4.  Ajouter un outil de simulation avec schéma de paramètres strict.
5.  Tester les demandes ambiguës, les paramètres invalides et les
    réponses sans données.
6.  Afficher clairement les résultats issus du moteur et les
    explications générées.

Ne pas supposer qu'un modèle, une fonctionnalité ou un quota est
accessible avant de le vérifier dans la documentation et le portail
officiel du hackathon.

### Multilinguisme

Le MVP peut commencer en français. Une démonstration en malgache est une
bonne extension si les réponses sont relues par un locuteur compétent.
La qualité linguistique doit être évaluée : ne pas promettre une
couverture multilingue fiable sans tests.

---

## 8. Détection d'anomalies : extension optionnelle

La détection d'anomalies n'est pas au cœur du MVP. Si le parcours
principal est terminé, ajouter un signal simple : - écart persistant
entre l'énergie produite, l'énergie mesurée et les pertes estimées ; -
hausse soudaine d'une consommation par rapport au profil simulé ; -
compteur simulé qui rapporte une valeur incohérente.

Le système doit afficher **« anomalie à vérifier »**, jamais « fraude
confirmée ». Les écarts peuvent être causés par des erreurs de mesure,
des appareils défectueux ou des données manquantes. La démonstration
peut injecter une anomalie synthétique, clairement étiquetée.

---

## 9. Interface et expérience utilisateur

### Écrans MVP

**Écran 1 --- Vue d'ensemble** - production solaire actuelle ; - niveau
de batterie ; - demande et énergie livrée ; - état synthétique des cinq
secteurs ; - badge « données simulées ».

**Écran 2 --- Scénarios** - sélection d'un scénario ; - réglage de la
baisse de production ; - exécution et retour aux paramètres initiaux ; -
comparaison des stratégies.

**Écran 3 --- Résultats** - graphiques de production, demande et
batterie ; - énergie livrée/non servie par secteur ; - avertissements en
cas de contraintes non satisfaites ; - hypothèses et paramètres de
calcul.

**Écran 4 --- Copilote** - chat ; - questions suggérées ; - explication
d'un résultat sélectionné ; - boutons pour lancer des simulations
autorisées.

### Principes UX

- Montrer les unités et périodes pour chaque mesure.
- Distinguer visuellement les données réelles, simulées et estimées.
- Afficher les hypothèses au même endroit que les résultats.
- Préférer « scénario simulé » à « prédiction certaine ».
- Éviter les visualisations qui donnent une fausse impression de
  précision.

---

## 10. Plan de réalisation sur dix jours

Chemin critique : **moteur → tableau de bord 2D → copilote Meta → scène 3D**. Le copilote passe
avant la 3D : c'est la fonctionnalité évaluée par un hackathon Meta et elle dépend d'une API externe ;
la 3D est un travail local, facile à borner dans le temps. Tâches détaillées : `docs/tasks/`.

| Jour | Phase                                       | Livrable                                                                        | Critère de validation                      |
| ---- | ------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------ |
| 1    | P0 Cadrage + P1 Dépôt                       | Accès Meta vérifié (appel d'outil), règles du hackathon, monorepo, CI, 5 routes | `pnpm dev` et CI verts                     |
| 2    | P2 Design system (en parallèle) + P3 Moteur | Écrans Stitch, tokens, kit UI, shell ; schémas et modèle                        | Shell conforme aux maquettes               |
| 3    | P3 Moteur                                   | 2 stratégies, métriques, invariants, 5 scénarios                                | Tests verts, 0 violation, reproductible    |
| 4    | P4 Tableau de bord 2D + Strategy Lab        | Indicateurs, graphiques, comparaison                                            | Scénario nuageux comparé de bout en bout   |
| 5    | P5 Contrôles et scénarios                   | Curseurs validés, écran scénarios, export du résumé                             | Scénario configurable en moins de 30 s     |
| 6–7  | P6 Copilote Meta                            | Outils contrôlés, SSE, preuves, propositions, repli `mock`, jeu d'évaluation    | Chiffres de la réponse = preuves du moteur |
| 7–8  | P7 Scène 3D                                 | Village en primitives, lié au résultat, repli 2D                                | 2D et 3D affichent le même résultat        |
| 9    | P8 Qualité                                  | E2E Playwright, accessibilité, performance, responsive                          | Démo répétée 3 fois sans intervention      |
| 10   | P9 Livraison                                | Déploiement, README, vidéo, soumission                                          | URL publique, vidéo et dépôt cohérents     |

### Règle de réduction de périmètre

Si le planning glisse, supprimer dans cet ordre : 1. détection
d'anomalies ; 2. stratégie « équilibrée » ; 3. lecture temporelle
(timeline) ; 4. export ; 5. finition mobile ; 6. malgache ; 7. préréglages de caméra 3D. La météo réelle et le service Python sont
déjà hors périmètre.

Ne pas sacrifier le bilan énergétique, la comparaison des stratégies,
les garde-fous de l'agent, le repli `mock` du copilote, les étiquettes
« données simulées » ou la répétabilité de la démonstration.

---

## 11. Tests et critères d'acceptation

### Tests fonctionnels minimaux

- **Scénario nominal :** la production couvre la demande et les
  contraintes de batterie sont respectées.
- **Baisse solaire :** une réduction de production modifie les
  résultats de manière cohérente.
- **Batterie à la réserve minimale :** le moteur ne décharge pas sous
  le seuil autorisé.
- **Demande impossible :** le système signale l'énergie non servie au
  lieu de prétendre que tout est alimenté.
- **Paramètre invalide :** la simulation est rejetée avec un message
  clair.
- **Question sans données :** l'agent reconnaît l'incertitude et ne
  fabrique pas de chiffre.
- **Outil indisponible :** le chat explique l'échec et ne prétend pas
  que l'action a réussi.
- **Reproductibilité :** les mêmes paramètres produisent les mêmes
  résultats lorsque le scénario est déterministe.

### Définition de « terminé »

Le MVP est prêt lorsque : - les cinq secteurs apparaissent dans le
tableau de bord ; - le scénario de baisse de production peut être
relancé ; - les deux stratégies sont comparées sur les mêmes entrées ; -
les métriques proviennent du moteur ; - l'agent peut consulter l'état et
lancer une simulation valide ; - les paramètres invalides sont bloqués
; - toutes les vues de démonstration indiquent que les données sont
simulées ; - la vidéo et le README permettent à un évaluateur de
comprendre et relancer le projet.

---

## 12. Sécurité, équité et limites

### Sécurité technique

- Aucun accès de l'agent à des actionneurs physiques dans le MVP.
- Validation côté serveur de tous les paramètres de scénario.
- Limites sur la durée, l'ampleur et le nombre de simulations.
- Gestion des erreurs de l'API de modèle et des quotas.
- Secrets stockés dans des variables d'environnement, jamais dans le
  dépôt.
- Journalisation des paramètres et résultats nécessaires à l'audit,
  sans secrets.

### Équité et gouvernance

Les priorités entre santé, eau, foyers, école et activités économiques
sont des choix sociaux, pas seulement mathématiques. Les poids de
l'optimisation doivent être configurables, expliqués et validés par les
personnes concernées avant une application réelle.

La détection d'anomalies doit soutenir l'inspection, pas accuser. Une
consommation inhabituelle peut avoir des explications légitimes. Le
système doit indiquer le niveau d'incertitude et permettre une
vérification humaine.

### Limites du prototype

- Le réseau et les charges sont simulés.
- Le modèle énergétique est simplifié.
- Les profils de consommation ne sont pas nécessairement
  représentatifs d'un village réel.
- Les résultats ne prouvent pas des économies ou des gains de
  fiabilité sur le terrain.
- Une mise en production nécessiterait une expertise énergétique, des
  essais de sécurité, une validation réglementaire et une consultation
  des utilisateurs.

---

## 13. Indicateurs de réussite du projet

Les objectifs de démonstration doivent être mesurables et modestes :

- zéro violation des contraintes de batterie dans les tests ;
- deux stratégies comparables sur les mêmes entrées ;
- toutes les métriques clés traçables jusqu'au moteur ;
- un scénario de pénurie exécutable en moins de quelques secondes sur
  la machine de démo ;
- au moins cinq questions de chat testées, dont une demande invalide ;
- une démo de trois minutes reproductible ;
- aucune affirmation d'économie ou de performance non étayée.

Les temps de réponse et les performances réelles doivent être mesurés
pendant le développement plutôt que garantis à l'avance.

---

## 14. Structure de dépôt retenue

```text
mitsinjo-grid/
├── CLAUDE.md  AGENTS.md  HANDOFF.md      # point d'entrée et passation entre agents
├── docs/                                  # architecture, contrats, moteur, copilote, design, tâches
├── packages/
│   └── engine/                            # @mitsinjo/engine : TS pur, Zod, sans React
│       └── src/{schemas,model,strategies,metrics,scenarios}/ simulate.ts compare.ts index.ts
└── apps/
    └── web/                               # Next.js 15 App Router
        ├── e2e/                           # Playwright : parcours de démo
        └── src/
            ├── app/(lab)/{overview,simulation,strategies,scenarios,copilot}/page.tsx
            ├── app/api/copilot/route.ts
            ├── features/{overview,simulation,microgrid-3d,strategy-lab,scenarios,copilot}/
            │                              # ui/ hooks/ utils/ __tests__/ index.ts
            ├── components/{ui,layout,charts}/
            ├── stores/simulation.store.ts # état unique : entrée, statut, résultats, sélection
            ├── server/copilot/            # serveur uniquement : fournisseur LLM, outils, boucle
            └── lib/
```

Règles du frontend : pages = imports seulement ; une feature = `ui/` (présentation),
`hooks/` (logique), `utils/` (fonctions pures), `__tests__/` obligatoires, `index.ts` public.
Créer les dossiers au moment où ils servent, pas à l'avance.

---

## 15. README et présentation au jury

Le dépôt devrait contenir : - une description du problème et des
utilisateurs ; - une capture d'écran ou un GIF du scénario principal ; -
un schéma d'architecture ; - les hypothèses du simulateur ; - les étapes
d'installation et de lancement ; - les variables d'environnement
nécessaires, sans secrets ; - les tests et leur commande ; - la
distinction entre données réelles, simulées et estimées ; - les limites
et les pistes futures ; - la vidéo de démonstration.

### Formulation à privilégier

**À dire :** « Sur ce scénario simulé, la stratégie priorisée réduit
l'énergie non servie aux charges critiques par rapport à la stratégie de
référence, selon les paramètres affichés. »

**À éviter :** « Notre IA garantit l'électricité au village » ou « notre
système détecte les fraudeurs », car ces affirmations dépassent ce que
le prototype peut démontrer.

---

## 16. Évolutions après le hackathon

1.  Tester les hypothèses avec des opérateurs de mini-réseaux et des
    représentants de services essentiels.
2.  Remplacer progressivement les profils synthétiques par des données
    autorisées et anonymisées.
3.  Améliorer la prévision de production et de demande après avoir
    obtenu des données historiques suffisantes.
4.  Ajouter une analyse des anomalies avec procédures de vérification
    humaine.
5.  Étudier une connexion en lecture seule à un système de supervision
    existant.
6.  Faire auditer le modèle énergétique et les règles de sécurité avant
    toute interaction avec du matériel réel.
7.  Évaluer l'utilité de l'interface en malgache avec des locuteurs et
    utilisateurs cibles.

---

## 17. Décisions à prendre avant de coder

- Confirmer l'accès au modèle Meta et à l'API réellement disponibles
  pour le hackathon.
- ~~Décider si le MVP reste dans un seul projet Next.js ou nécessite un
  service séparé.~~ **Décidé :** `apps/web` + `packages/engine` (§5).
- ~~Choisir le pas de temps et les unités.~~ **Décidé :** 24 h, pas
  horaire, kW/kWh (`docs/contracts.md`).
- Choisir la langue de l'interface (anglais pour le jury, français en
  option).
- Définir et documenter les priorités des cinq secteurs.
- ~~Choisir la stratégie de référence.~~ **Proposé :** proportionnelle,
  essentiels d'abord, équilibrée en option (`docs/engine-spec.md`).
- Valider les hypothèses de batterie et de demande proposées
  (`docs/engine-spec.md` §5).
- Définir les scénarios et questions utilisés dans la vidéo.
- Confirmer les règles de soumission, les licences et les exigences
  officielles du hackathon.

## Conclusion

Mitsinjo Grid doit être présenté comme un **copilote de décision
énergétique**, et non comme un système autonome qui contrôle un réseau
réel. Sa force est la combinaison d'un simulateur compréhensible, d'un
moteur d'optimisation vérifiable et d'un agent IA qui transforme les
résultats en explications et scénarios explorables.

Pour le hackathon, la meilleure stratégie est de livrer un seul parcours
impeccable : **baisse de production → comparaison des stratégies →
explication conversationnelle → preuve chiffrée**. Tout le reste est
secondaire tant que ce parcours n'est pas fiable.
