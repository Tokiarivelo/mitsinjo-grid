# PA — Dispatch orchestré par l'IA (mode autonome, journal d'événements, scénario par le chat)

**Read first:** `docs/contracts.md` · `docs/engine-spec.md` §1 et §6 · `docs/copilot.md` (outils, repli) ·
`apps/web/src/lib/{autopilot,constitution,envelope}.ts` (M10, à absorber)
**Skills:** `/engine-change` (détecteurs, politique) · `/copilot-tool` (narration, outil journal) ·
`/ui-feature` + `/design-check` (bascule, journal, alertes, carte brouillon) · `/scene-3d` (zones en alerte)

**Objectif.** Une bascule **« Dispatch : Manuel · Assisté · IA autonome »**. En mode IA autonome, à chaque heure
simulée, l'IA **détecte** les événements (incendie, surconsommation, réserve batterie, surplus solaire…), **décide**
(isoler, délester, changer de stratégie, protéger le dispensaire, alerter) et **applique sans validation humaine**.
Chaque détection et chaque action est écrite dans un **journal d'événements** horodaté, avec les chiffres moteur avant/après.

En plus, l'opérateur peut **décrire un scénario dans le chat** (« jour 1 : nuageux, jour 2 : pluvieux, jour 3 : beau
temps + école en feu ») : le copilote le transforme en brouillon structuré, **pose des questions** (avec réponses
suggérées) tant qu'il manque une information, puis **propose de lancer la simulation** (en mode manuel ou IA autonome).

**Changement de règle — validé par l'opérateur le 2026-11-02.** Jusqu'ici (PM §0) toute action passait par
`propose_change` → Approuver/Refuser. En mode IA autonome cette validation disparaît. Ce qui reste intouchable :

- Les chiffres viennent de `@mitsinjo/engine`. La **décision** est calculée par le moteur (candidats simulés) ; le LLM
  la **raconte** (et au mieux choisit parmi des candidats déjà vérifiés). Il n'invente jamais d'action ni de kW.
- La **constitution** du village (M10-T2) reste un garde-fou dur : jamais couper le dispensaire, planchers minimaux.
- Jamais de remise sous tension d'un secteur en feu (seulement à la fin de l'événement `fire`).
- **Reprendre la main** = un tap (retour Manuel immédiat) ; chaque action IA est annulable (`undoLastChange`).
- Repli déterministe : sans clé Meta, la politique à règles décide et un texte gabarit remplace la narration.

---

## Ce qu'on peut intégrer avec cette idée

| #   | Idée                                                                                                    | Base existante                       |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | Bascule 3 niveaux Manuel / Assisté / IA autonome (en-tête, barre latérale, `MobileNav`)                 | autopilot + enveloppe M10            |
| 2   | Journal d'événements : sévérité, heure simulée, détection → décision → action → effet ; filtres         | `changeHistory`                      |
| 3   | Clic sur une ligne du journal → curseur à cette heure + secteur en surbrillance (2D/3D)                 | `setTimeIndex`, `selectSector`       |
| 4   | Détecteur incendie (événements `fire` actifs) → isolation immédiate + alerte                            | `activeFires`, `FIRE_ISOLATION`      |
| 5   | Détecteur surconsommation : demande > solaire + décharge max, pic vs profil, secteur qui explose        | `demand_spike`, `SECTOR_PARTIAL`     |
| 6   | Détecteur réserve batterie + **prévision** de déficit critique dans les N prochaines heures             | `RESERVE_REACHED`, `simulate`        |
| 7   | Détecteur surplus solaire (écrêtage) → décaler les charges flexibles (pompage, atelier) à midi          | `CURTAILMENT`, `flexible`            |
| 8   | Détecteur anomalie de compteur → alerte « à vérifier » (jamais une coupure)                             | `ANOMALY_TO_VERIFY`                  |
| 9   | Actions : isoler, plafonner, délester flexible, stratégie, plancher dispensaire, réserve nuit, rétablir | `InputPatch`, `sectorCaps`, lifeline |
| 10  | Décision prédictive : simuler 3–6 h en avance chaque action candidate, garder la meilleure              | `simulate`, `sweep`                  |
| 11  | Contrefactuel « si l'IA n'avait rien fait » → KPI « énergie critique sauvée par l'IA »                  | `proposalImpact`                     |
| 12  | Narration Muse Spark par décision (1–2 lignes, valeurs citées) + « Pourquoi ? » → copilote              | provider + `evidence`                |
| 13  | Rapport de quart en fin de journée (résumé du journal) ; BD de la journée avec les incidents            | `day-comic-block`                    |
| 14  | Alertes : bannière, toasts, son, annonce vocale FR/MG, affiche de délestage générée                     | fire-alert, `speech-voice`, poster   |
| 15  | Message simulé au chef de village (aperçu SMS, jamais envoyé)                                           | —                                    |
| 16  | 3D : zone en alerte qui clignote, badge « IA » sur le secteur touché, ligne coupée                      | `fire-views`, `distribution-lines`   |
| 17  | Copilote : questions générées depuis le journal (« Pourquoi as-tu coupé le marché à 14 h ? »)           | `suggestPrompts`                     |
| 18  | Outil copilote `get_dispatch_log` ; en mode IA, `propose_change` s'applique seul après constitution     | `tools.ts`                           |
| 19  | Mode chaos : incidents aléatoires **seedés** (feu, pic, panne de ligne) pour stresser l'IA              | `village_fire`, générateur M12-T2    |
| 20  | Strategy Lab : carte « IA autonome » comparée aux 3 stratégies sur le même scénario                     | `compare`                            |
| 21  | Journal exportable JSON/CSV, entrées hachées (audit, reproductible)                                     | `hash.ts`, export P5                 |
| 22  | Maquette physique : les actions IA partent au bridge (MOSFET/PWM)                                       | M9-T1                                |
| 23  | Budget d'autonomie : max N actions / heure, pas deux actions contraires en 2 h (anti-oscillation)       | enveloppe                            |
| 24  | **Scénario par le chat** : texte libre (FR/EN/MG, voix) → brouillon jour par jour (météo + événements)  | `simulate_week`, extracteur M10-T4   |
| 25  | Questions de complétion : le code liste les trous, le LLM les formule, des puces proposent les réponses | `suggestPrompts`, puces              |
| 26  | Carte « Brouillon de scénario » éditable dans le chat + « Lancer » / « Lancer en mode IA autonome »     | `ProposalCard`                       |
| 27  | Événements par jour (feu le jour 3 seulement) dans le workflow multi-jours                              | `WorkflowDay`, `simulateWorkflow`    |
| 28  | Aperçu moteur avant lancement (déficit par jour, pire jour) ; « Mes scénarios » sauvegardés + JSON      | `compareWorkflow`, export P5         |

---

## Planning (≈ 10 jours de travail)

| Jour  | Phase                                                  | Résultat visible                                                 |
| ----- | ------------------------------------------------------ | ---------------------------------------------------------------- |
| J1    | **PA-0** Contrats, spec, maquette                      | — (socle) ; maquette Stitch de la bascule et du journal          |
| J2    | **PA-1** Détecteurs (moteur)                           | tests : chaque scénario produit les bons incidents               |
| J3–J4 | **PA-2** Politique de décision (moteur)                | tests : 0 kWh critique non servi quand c'est faisable            |
| J5    | **PA-3** Orchestrateur + store                         | lecture : l'IA agit seule, journal rempli, « Reprendre la main » |
| J6    | **PA-4** UI (bascule, journal, alertes)                | démo complète en mode IA, mobile + clair/sombre                  |
| J7    | **PA-5** Narration IA + copilote                       | chaque action a sa phrase Muse Spark ; « Pourquoi ? » marche     |
| J8    | **PA-6** Scénarios d'incident                          | mode chaos, `overload_evening`                                   |
| J9    | **PA-8** Scénario par le chat (moteur + outil)         | « jour 3 école en feu » devient un brouillon valide              |
| J10   | **PA-8** Dialogue, carte, lancement + **PA-7** qualité | questions → brouillon complet → « Lancer » ; e2e                 |

PA-8 ne dépend que de PA-T8a (moteur) : il peut démarrer en parallèle de PA-1…PA-5. Le bouton « Lancer en mode IA
autonome » attend PA-3.

### PA-0 — Contrats et spec · J1

- [x] **PA-T0a** ~~Décision humaine~~ (validée le 2026-11-02). Écrire la règle dans `CLAUDE.md` et
      `docs/ideas-meta-models.md` §0. **Done when** la règle « mode IA = pas de validation, garde-fous ci-dessus » est
      la seule version dans les docs.
- [x] **PA-T0b** Schémas Zod (moteur) : `DispatchMode` (`manual|assisted|autonomous`), `Incident`
      (`kind`, `severity`, `hour`, `sector?`, `evidence`), `AutoAction` (`kind`, `patch?`, `strategy?`, `reason`),
      `DispatchLogEntry` (`id`, `hour`, `day`, `incident?`, `action?`, `before`, `after`, `narration?`, `hash`).
      **Done when** `docs/contracts.md` les liste et `schemas` les exporte avec tests.
- [x] **PA-T0c** (spec faite : engine-spec §6b ; maquette / tokens intégrés dans stitch-map.md) `docs/engine-spec.md` § « Dispatch autonome » : seuils de chaque détecteur, ordre des actions,
      fonction objectif. Note Stitch (bascule + journal + alerte) → `docs/design/stitch-map.md`.

### PA-1 — Détecteurs (pur, moteur) · J2

- [x] **PA-T1** `detectIncidents(input, result, hour, lookaheadH = 3)` → `Incident[]` triés par sévérité :
      `fire`, `overload` (demande > dispo), `demand_surge` (> 130 % du profil), `reserve_low`, `critical_forecast`,
      `solar_surplus`, `meter_anomaly`, `lifeline_shortfall`. **Done when** tests par scénario : `village_fire` →
      `fire` market 14 h puis water 15 h ; `high_demand` → `overload` 17–22 h ; `baseline` → `solar_surplus` midi seulement.

### PA-2 — Politique de décision (pur, moteur) · J3–J4

- [x] **PA-T2a** `candidateActions(incident, input)` : isoler, plafonner, délester flexible, stratégie,
      plancher dispensaire, réserve nuit (min SoC ↑), décaler charge flexible, rétablir.
- [x] **PA-T2b** `decideDispatch(input, hour, strategy, incidents, rules)` : simule chaque candidat sur
      `hour..hour+6`, écarte les violations de constitution, garde le meilleur (critique non servi ↓, puis non servi ↓,
      puis SoC fin ↑) ; renvoie aussi le contrefactuel « rien faire ». Déterministe, budget < 20 ms / heure.
      **Done when** sur les 7 scénarios : critique non servi en mode IA ≤ meilleure stratégie fixe ; tests.
- [x] **PA-T2c** Anti-oscillation : pas d'action contraire à la précédente sur le même secteur en moins de 2 h ;
      max 2 actions / heure. Tests.

### PA-3 — Orchestrateur et store · J5

- [x] **PA-T3a** Store : `dispatchMode`, `dispatchLog`, `setDispatchMode`, `takeBackControl` (→ manual).
      Les actions IA passent par `approveChange('ai-…')` (undo gratuit). Journal persisté dans Neon (table
      `dispatch_log`, nouvelle migration dans `server/db/migrations.ts`, appliquée par `make db-migrate`). Tests store.
- [x] **PA-T3b** Hook `useAiDispatch` (remplace `useAutopilot`) : sur chaque nouvelle heure de lecture en mode
      autonome → détecter → décider → appliquer → journaliser. Mode assisté = comportement M10 actuel (propositions).
      **Done when** lecture de `village_fire` en mode IA : 2 incidents, 2 isolations, alerte, journal de ≥ 4 lignes.
      La boucle autonome vit dans `useAutonomousDispatch`, montée **une seule fois** par `SimulationPage`
      (`useAiDispatch` garde l'état du mode assisté) : deux montages appliqueraient chaque action deux fois.
- [x] **PA-T3c** En mode IA, `propose_change` du copilote s'applique seul après constitution, journalisé « demandé
      par l'opérateur ». En mode manuel, rien ne change.

### PA-4 — UI · J6

- [x] **PA-T4a** Bascule 3 niveaux (en-tête, barre latérale, `MobileNav`) ; badge permanent « IA AUX COMMANDES »
      (ai-violet) + bouton « Reprendre la main » ≥ 44 px.
- [x] **PA-T4b** Panneau « Journal des événements » (simulation + colonne copilote) : sévérité, heure, texte IA
      distinct des chiffres, filtre, export JSON/CSV, clic → heure + secteur.
- [x] **PA-T4c** Alertes : réutiliser bannière/toasts incendie pour tout incident `critical` ; 3D : zone qui clignote.
      i18n EN/FR/MG, clair/sombre, 320 px. Captures `make shots` (design gate).

### PA-5 — Narration IA et copilote · J7

- [x] **PA-T5a** Route serveur `/api/dispatch/narrate` (Muse Spark) : reçoit l'entrée du journal + evidence,
      renvoie 1–2 phrases ; repli gabarit i18n ; cache par hash. Évals : aucun chiffre hors evidence.
- [x] **PA-T5b** Outil copilote `get_dispatch_log` + bouton « Pourquoi ? » par ligne ; questions suggérées
      générées depuis le journal (suite de `suggestPrompts`).
- [x] **PA-T5c** Rapport de quart (fin de journée) : incidents, actions, énergie critique sauvée (contrefactuel).

### PA-6 — Scénarios d'incident · J8

- [x] **PA-T6a** Scénario `village_fire` (marché 14 h → station de pompage 15 h). _(fait, voir engine-spec §6)_
- [x] **PA-T6b** Scénario `overload_evening` (surconsommation ménages + atelier branché) ; panne de ligne simulée.
- [x] **PA-T6c** Mode chaos : incidents tirés au sort **avec graine** dans le workflow multi-jours.

### PA-8 — Scénario par le chat · J9–J10

Exemple cible : « jour 1 : nuageux, jour 2 : pluvieux, jour 3 : beau temps + école en feu ».

- [x] **PA-T8a** (moteur) `WorkflowDay.events?: ScenarioEvent[]` : événements propres à un jour, ajoutés à ceux de
      l'input ce jour-là seulement ; la batterie continue de passer d'un jour à l'autre. Contrat + engine-spec.
      **Done when** un feu à l'école le jour 3 coupe l'école le jour 3 seulement ; workflows existants inchangés ; tests.
- [x] **PA-T8b** Schéma `ScenarioDraft` (web, Zod) : `title?`, `days[]` (1–7) de `{ weather?, events[] }`, événements
      partiels autorisés (`fire { sector?, startHour?, durationH? }`, `solar_drop`, `demand_spike { sector?, factor? }`),
      `startSocPct?`, `strategy?`, `dispatchMode?`. Fonction pure `missingSlots(draft)` → trous ordonnés : météo absente
      d'un jour, secteur ou heure du feu, facteur d'un pic, jour cité hors limite (> 7), contradiction (deux météos le
      même jour). `defaults(draft)` propose les valeurs par défaut (feu jusqu'à minuit, SoC 60 %, proportionnelle).
      **Done when** tests : l'exemple cible → 1 trou (heure du feu) ; brouillon complet → 0 trou.
- [x] **PA-T8c** Extracteur déterministe FR/EN/MG (repli sans clé, comme l'extracteur de réunion M10-T4) :
      « jour N / day N / andro N », mots météo (nuageux, pluvieux, orage, beau temps, ensoleillé / cloudy… / rahona,
      orana…), secteurs (école, dispensaire, marché, pompe, ménages, atelier), « en feu / incendie / afo ».
      **Done when** 15 phrases d'éval → brouillons attendus.
- [x] **PA-T8d** Outil copilote `draft_scenario` : le LLM remplit le brouillon depuis le message (et le brouillon
      précédent de la session) ; le serveur valide (Zod), calcule `missingSlots`, renvoie brouillon + trous. Le LLM ne
      pose que les questions des trous (une ou deux à la fois), jamais de chiffres moteur. Nouvel événement SSE
      `scenario_draft`. Évals : incomplet → question ; complet → proposition de lancement.
- [x] **PA-T8e** Carte « Brouillon de scénario » dans le chat : une ligne par jour (icône météo, événements), cases
      manquantes en ambre, édition directe (météo, secteur, heure), puces de réponse générées par le code depuis le
      type du trou (« À quelle heure commence le feu ? » → 8 h · 12 h · 16 h). Aperçu moteur une fois complet
      (déficit par jour, pire jour, critique non servi). i18n, clair/sombre, 320 px, design gate.
- [x] **PA-T8f** Lancement : « Lancer cette simulation » et « Lancer en mode IA autonome » → store
      `loadDraft(draft)` (input `custom` + workflow avec événements par jour) → run → `/simulation`, lecture au jour 1.
      « Enregistrer » → « Mes scénarios » (page Scénarios ; table Neon `scenario_drafts` via nouvelle migration,
      repli mémoire sans `DATABASE_URL`) + export/import JSON.
      **Done when** l'exemple cible se joue sur 3 jours, l'école brûle le jour 3 et, en mode IA, le journal montre
      détection + isolation sans clic.
- [x] **PA-T8g** Questions suggérées dans le chat vide : « Décris un scénario sur plusieurs jours… » et exemples
      (puces) ; questions générées depuis le brouillon en cours.

### PA-7 — Qualité · J10

- [x] **PA-T7** Playwright : parcours démo en mode IA (incendie → isolation auto → journal → « Pourquoi ? »
      → reprendre la main) et parcours chat (scénario 3 jours → question → réponse → « Lancer ») ; perf lecture 60 fps
      avec décision ; README (features/limits) ; `test-scenarios/`.

**Exit criteria.** En mode IA autonome, `village_fire` et `high_demand` se jouent sans aucun clic : chaque incident est
détecté, traité et journalisé avec chiffres moteur + phrase IA ; « Reprendre la main » rend le contrôle à l'instant.
Dans le chat, « jour 1 : nuageux, jour 2 : pluvieux, jour 3 : beau temps + école en feu » mène, après les questions
manquantes, à une simulation de 3 jours lancée d'un clic. Tout marche sans clé Meta (extracteur et règles déterministes).

---

## Déjà fait (session du 2026-11-02)

- Questions suggérées du copilote générées depuis la simulation lancée ; avant toute simulation, invitation
  « Lancez d'abord une simulation » (`RunSimulationCta`), plus de liste fixe.
- Scénario `village_fire` (PA-T6a) visible dans l'en-tête, la page Scénarios (badge « Incident ») et les outils copilote.
