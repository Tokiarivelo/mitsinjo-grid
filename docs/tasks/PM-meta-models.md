# PM — Exploiter tous les modèles Meta (voix, vision, image, contrôle, incendie)

**Read first:** `docs/ideas-meta-models.md` (banque d'idées, les IDs `V1`, `K1`, `F1`… y renvoient) ·
`docs/copilot.md` · `docs/contracts.md` · `docs/engine-spec.md` §1
**Skills:** `/copilot-tool` (outils, providers, SSE) · `/engine-change` (événement incendie) ·
`/ui-feature` + `/design-check` (dialogues, bannières, micro) · `/scene-3d` (fumée, ligne coupée)

**Objectif.** Passer d'un copilote texte (Spark 1.3) à un copilote qui **entend** (Voice Transcribe), **voit**
(Spark 1.3 vision, SAM 3.1), **illustre** (Muse Image), **raisonne longtemps** (Wonder) et **commande** le réseau simulé
(et la maquette) avec une question d'approbation à chaque fois, plus une alarme incendie.

**Règles intouchables** (rappel de `docs/ideas-meta-models.md` §0) :

- Les chiffres viennent de `@mitsinjo/engine`. Les modèles produisent des **observations**, jamais des kW / kWh / %.
- Toute action passe par `propose_change` → dialogue **Approuver / Refuser**. Seule exception : la coupure incendie
  déclenchée par un capteur ou par un humain (sécurité), dont la **remise sous tension** reste approuvée.
- Chaque modalité a un **repli mock déterministe** : la démo doit marcher sans clé Meta et sans réseau.
- Pas de chiffres dans les images générées : superposition HTML depuis le moteur.

---

## Calendrier

La date de soumission est à confirmer dans le règlement (P0-T2). Le planning compte en **jours de travail** à partir
du démarrage de PM. Le **sprint hackathon** (M0 → M6) tient en **6 jours** ; tout le reste est **après la soumission**
ou à couper.

| Jour     | Phase                                                                                              | Modèles                          | Résultat visible en démo                                    |
| -------- | -------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------- |
| J1 matin | **M0** Préparation, accès, mocks                                                                   | tous                             | — (socle)                                                   |
| J1 aprem | **M1** Contrôle par le chat + approbation enrichie                                                 | Spark 1.3                        | « Coupe le marché ce soir » → impact chiffré → Approuver    |
| J2       | **M2** Alarme incendie                                                                             | Spark 1.3                        | Bouton « Signaler un incendie » → coupure, fumée 3D, alerte |
| J3       | **M3** Voix                                                                                        | Voice Transcribe                 | Micro dans le chat, « Au feu à l'école ! », réponse lue     |
| J4       | **M4** Vision → paramètres                                                                         | Spark 1.3 (vision)               | Photo du ciel / compteur → patch proposé → moteur           |
| J5 matin | **M5** Images générées                                                                             | Muse Image                       | « Le village ce soir », affiche de délestage FR/MG          |
| J5 aprem | **M6** Intégration démo, évals, docs                                                               | —                                | Parcours démo enrichi, vidéo prête                          |
| J6       | **Tampon** + P9 (vidéo, soumission)                                                                | —                                | —                                                           |
| après    | **M7** Wonder multi-agents · **M8** SAM · **M9** maquette · **M10** autonomie · **M11** hors-ligne | Wonder, SAM, Glimmer, Spark Open | Voir phases                                                 |

**Chemin critique :** M0 → M1 → M2 → M3. M4 et M5 sont indépendants entre eux et peuvent s'intervertir.
M9 dépend du montage matériel **H5** (`PH-hardware-twin.md`).

### Ordre de coupe si en retard

1 M5 affiche (garder l'illustration seule) · 2 M4 compteur (garder le ciel) · 3 M3 mains libres (garder le micro) ·
4 M1 K3 multi-ordres · 5 M2 fumée 3D (garder bannière). **Ne jamais couper :** M0 mocks, M1 K1/K6, M2 F1/F2,
le dialogue d'approbation, les libellés SIMULATED / « Généré par IA ».

---

## Phase M0 — Préparation (J1 matin)

- [ ] **M0-T1** Tester chaque modèle. Fait le 2026-10-30 par appels réels (formats et latences dans `docs/copilot.md`) :
      vision Spark 1.3 ✓ (≈ 10 s, Spark 1.1 inutile), SAM 3.1 ✓ (≈ 5 s), Muse Image ✓ (12–23 s), Voice ✓ (≈ 3 s, WAV seul).
      **Reste (humain) :** enregistrer 5 phrases FR + malagasy (dont « Au feu à l'école ! ») en WAV et noter le verdict
      « MG utilisable : oui/non ».
- [x] **M0-T2** Variables d'env (`lib/env.ts`, `.env.example`, `docs/setup/env.md`) : `META_VOICE_MODEL`,
      `META_IMAGE_MODEL`, `META_VISION_MODEL`, `META_SEGMENT_MODEL`, `META_SPEND_CAP_USD` (défauts sûrs).
- [x] **M0-T3** `server/perception/` : `transcribe()`, `analyzeImage()`, `segmentImage()` (client Meta + mock déterministe par
      mot-clé / nom de fichier, repli automatique). `generateImage()` reste dans `providers/meta.ts` (déjà en place, réutilisé).
- [x] **M0-T4** `server/spend/` : coût estimé par session, au-delà de `META_SPEND_CAP_USD` → mock + `PROVIDER_FALLBACK`
      `reason: 'spend_cap'` (chat, image et perception).
- [x] **M0-T5** Changement automatique de modèle **par appels d'outils** (pas de mots-clés) : Spark choisit
      `generate_image` (Muse Image), `segment_image` (SAM sur la photo jointe, « Perception IA ») ou
      `escalate_deep_reasoning` (Wonder, jamais en urgence). Le routeur ne garde que le choix explicite et
      « photo jointe → vision ». Le mock imite ces choix par mots-clés (hors-ligne seulement).
- [x] **M0-T6** Modèles Contributor privilégiés (`META_PREFER_CONTRIBUTOR`, chat + vision) avec repli automatique
      sur le modèle standard (403 / 404 / 429) ; la garde de dépense facture le modèle qui a répondu.

**Exit M0 :** chaque modalité a un client réel derrière un flag et un mock testé.

---

## Phase M1 — Contrôle par le chat avec approbation (J1 après-midi) · `K1–K6`

L'existant (`propose_change` + `ConfirmProposalDialog`) gère déjà coupure (`sectorCaps maxKw 0`), limite de
puissance, branchement (`sectorLoads`), plancher de survie, priorités, stratégie.

- [x] **M1-T1** (K1) Impact chiffré dans le dialogue : le serveur joint à la proposition le résultat moteur
      avant / après (`compare` sur l'entrée actuelle et l'entrée patchée) : énergie servie par secteur,
      SoC min, heures coupées. Le dialogue l'affiche en bloc « Calcul moteur ».
      **Done when** test : chiffres du dialogue ⊆ evidence ; dark/light, 390 px.
- [x] **M1-T2** (K6) Garde clinique **par du code** : patch qui coupe `health` ou met son plancher à 0 →
      avertissement rouge + seconde confirmation. **Done when** test unitaire de la règle + test UI.
- [ ] **M1-T3** (K2) « Maintenant » : le contexte du chat envoie l'heure courante (lecture ou maquette) ;
      le prompt l'utilise pour `fromHour` ; le dialogue affiche la plage retenue. **Done when** éval
      « Coupe le marché maintenant » → `fromHour` = heure courante.
- [ ] **M1-T4** (K4) Historique des changements approuvés + « Annuler le dernier » (store).
      **Done when** test du store : approuver puis annuler = entrée initiale.
- [ ] **M1-T5** (K3, coupable) Plusieurs changements dans une proposition, cases à cocher par ligne.
      **Done when** approbation partielle n'applique que les lignes cochées (test).
- [ ] **M1-T6** Évals : ajouter 4 cas à `eval.cases.ts` (coupure maintenant, limite 2 kW, couper la clinique →
      double confirmation, « c'est fait ? » → jamais d'affirmation d'application).

**Exit M1 :** toute commande du chat aboutit à un dialogue avec impact moteur ; rien ne s'applique sans clic.

---

## Phase M2 — Alarme incendie (J2) · `F1, F2, F6` · `/engine-change` puis `/ui-feature`

- [ ] **M2-T1** (F1) Moteur : événement `{ type: 'fire', sector, startHour, endHour? }` ajouté à
      `ScenarioEventSchema` (à côté de `solar_drop`, `demand_spike`). Secteur en feu = 0 kW, **prioritaire sur
      stratégie, plafonds et plancher de survie** ; mode `off`, départ `cut` ; avertissement `FIRE_ISOLATION`.
      **Done when** tests : feu à 14 h → secteur 0 kW de 14 h à la fin (ou `endHour`), énergie redistribuée,
      invariants de bilan OK, plancher ignoré pour ce secteur ; `docs/contracts.md` + `docs/engine-spec.md`.
- [ ] **M2-T2** (F2) Bouton « Signaler un incendie » (/simulation + chat) : choix du secteur → l'événement est
      appliqué **directement** (exception sécurité, documentée) à l'heure courante. Bannière rouge persistante,
      `aria-live="assertive"`. **Done when** test UI + i18n EN/FR/MG + `make check-i18n`.
- [ ] **M2-T3** 3D / 2D : bâtiment en feu = fumée (particules légères, budget `docs/performance.md`), ligne `cut`.
      Repli 2D : icône + couleur `critical`. **Done when** `make shots` dark/light, fps dans le budget.
- [ ] **M2-T4** Copilote : nouvel outil lecture `get_incidents` + règles du prompt (« la coupure incendie est
      automatique ; tu expliques, tu proposes la suite, tu ne rétablis jamais »). Remise sous tension = `propose_change`
      qui retire l'événement → dialogue. **Done when** évals : « rétablis l'école » → proposition, pas d'action ;
      « l'école brûle » → explique la coupure + impact.
- [ ] **M2-T5** (F6) Résumé post-incident par le copilote (heure, secteur, énergie non servie **du moteur**).

**Exit M2 :** feu signalé → coupure immédiate en simulation → alerte + explication IA → rétablissement approuvé.

---

## Phase M3 — Voix (J3) · `V1, V3, F5, V2` · Voice Transcribe

- [x] **M3-T1** Route `app/api/voice/route.ts` : audio (webm/ogg ≤ 60 s, upload R2 existant ou data URL) →
      `transcribe()` → `{ text, segments[], speakers[] }`. Zod en entrée et sortie, `server-only`, pas de stockage
      de l'audio par défaut. **Done when** tests route (mock) + taille max refusée.
- [x] **M3-T2** (V1) Bouton micro dans le chat (`MediaRecorder`), appui long ou bascule, ≥ 44 px ; le texte transcrit
      s'affiche dans le champ, **modifiable avant envoi**. Permission refusée → message + clavier.
      **Done when** test hook `useVoiceInput` + UI mobile 390 px.
- [ ] **M3-T3** (V3, F5) Commandes vocales → mêmes outils que le texte. Urgence détectée (« au feu », « incendie »,
      « afo » en MG à valider M0-T1) → ouvre directement le dialogue incendie pré-rempli. **Done when** évals sur
      transcriptions FR/MG fixes.
- [ ] **M3-T4** Réponse lue à voix haute (`speechSynthesis`, FR/EN ; MG : texte seul si aucune voix), bouton
      couper le son. Ne lit **pas** les blocs de preuve chiffrée en entier (résumé). **Done when** test du choix de voix.
- [ ] **M3-T5** (V2, coupable) Mode mains libres : détection de fin de parole → envoi automatique.

**Exit M3 :** on pilote la démo à la voix sur mobile ; repli clavier partout.

---

## Phase M4 — Vision → paramètres (J4) · `E1, E4, E7` · Spark 1.3 (vision)

- [x] **M4-T1** `adaptive-router.ts` : message avec image → vision (Spark 1.3) — fait en M0-T5.
- [ ] **M4-T2** Outil `analyze_image(mediaKey, question)` → `observations[]` `{ label, value, unit, confidence, source }`
      (Zod). Événement SSE `perception`. **Done when** contrat dans `docs/contracts.md` + tests loop (mock).
- [ ] **M4-T3** Outil `observation_to_patch` (code pur, pas LLM) : couverture nuageuse → `solarDropPct` proposé ;
      relevé compteur → `meterReadings`. Toujours via `propose_change`. **Done when** tests de conversion + bornes.
- [ ] **M4-T4** UI : bloc **« Perception IA »** (3ᵉ style, distinct de « Calcul moteur » et du texte IA), valeur
      modifiable avant de proposer. **Done when** `/design-check` dark/light, mobile.
- [ ] **M4-T5** Évals : photo ciel nuageux → proposition de baisse solaire ; photo floue → « illisible », pas de chiffre.

**Exit M4 :** photo du ciel → observation → patch proposé → comparaison moteur → explication.

---

## Phase M5 — Images générées (J5 matin) · `I2, I1` · Muse Image

- [ ] **M5-T1** `server/media/generate-image.ts` + outil `generate_visual(kind, resultId)` : prompts gabarits
      (`village_tonight`, `shedding_poster`) construits **depuis le résultat moteur** (secteurs servis / coupés,
      plages horaires en mots), interdiction des chiffres dans le prompt. Stockage R2 existant. Événement SSE `media`.
- [ ] **M5-T2** (I2) Illustration « le village ce soir » dans le chat (lightbox existante), badge « Généré par IA ».
- [ ] **M5-T3** (I1) Affiche de délestage FR/MG : image sans chiffres + horaires du moteur en surcouche HTML,
      export PNG. **Done when** test : les horaires affichés = résultat moteur.
- [ ] **M5-T4** Repli : échec image → texte seul + `PROVIDER_FALLBACK` (déjà en place, à tester pour ce cas).

---

## Phase M6 — Intégration démo et qualité (J5 après-midi)

- [ ] **M6-T1** `docs/demo-script.md` : parcours enrichi en 3 min — _« Un nuage arrive » (voix) ou photo du ciel →
      baisse solaire → comparaison → explication lue → preuve → « coupe le marché ce soir » + impact → Approuver →
      affiche FR/MG → « Au feu à l'école ! » → coupure + alerte_.
- [ ] **M6-T2** E2E Playwright (mock) : chat → proposition → approbation ; signalement incendie → bannière.
- [ ] **M6-T3** Docs : `docs/copilot.md` (outils, modèles, routage), `docs/contracts.md`, `docs/architecture.md`
      (`server/perception`, `server/media`), README (fonctionnalités + limites : simulé, MG voix, pas de TTS Meta).
- [ ] **M6-T4** `make check`, `make e2e`, `make shots` ; scénarios manuels `test-scenarios/` (05-copilote,
      02-simulation, 00-parcours-demo).

**Exit sprint hackathon :** démo reproductible avec et sans clé Meta, toutes les modalités M1–M5 visibles.

---

## Après la soumission (ou si du temps reste)

### M7 — Wonder : raisonnement long et multi-agents · `W1, W2, W4, W5`

- [ ] **M7-T1** (W2) Conseil des agents de secteur : 5 sous-agents + médiateur, chaque proposition simulée par le
      moteur, UI en bulles avec badges chiffrés du moteur. Budget de tours et de coût.
- [ ] **M7-T2** (W1) Outil `simulate_week` + planificateur 7 jours.
- [ ] **M7-T3** (W4) Post-mortem « pourquoi la batterie était vide à 3 h ? » (chronologie causale).
- [ ] **M7-T4** (W5) Red team automatique → nouveaux cas dans `eval.cases.ts`.

### M8 — SAM 3.1 : segmentation · `S1, F4, S4`

- [ ] **M8-T1** `segment_image` + surcouche des masques dans la lightbox.
- [ ] **M8-T2** (S1) Inspection des panneaux (ombre, poussière) → perte proposée.
- [ ] **M8-T3** (F4) Fumée / feu sur caméra → dialogue « Incendie détecté ? Couper ? » (**jamais** de coupure
      automatique sur estimation IA).
- [ ] **M8-T4** (S4) Suivi du nuage sur la vidéo de la maquette → `solarProfile` mesuré.

### M9 — Maquette physique · `K5, F3, V7, C4` · dépend de H5

- [ ] **M9-T1** (K5) Patch approuvé → bridge → MOSFET coupé / PWM limité ; dialogue « s'applique aussi à la maquette ».
- [ ] **M9-T2** (F3) Capteur fumée/flamme par bâtiment : coupure **locale** dans le firmware (sans réseau), message
      MQTT `fire` → bridge → événement `fire` dans l'app. Rétablissement : approbation dans l'app + capteur calme.
- [ ] **M9-T3** (V7) « Fais passer le nuage » → proposition → servo nuage.
- [ ] **M9-T4** (C4) Boucle complète capteur + IA + validation + maquette, en vidéo.

### M10 — Autonomie encadrée · `C1, C2, C3, V4`

- [ ] **M10-T1** (C1) Autopilote : une proposition par heure simulée, accept/refus d'un tap, historique.
- [ ] **M10-T2** (C3) Constitution du village (règles stockées, vérifiées par du code).
- [ ] **M10-T3** (C2) Enveloppe d'autonomie (désactivée par défaut, simulation seulement).
- [ ] **M10-T4** (V4) Réunion enregistrée → diarisation → priorités → patch proposé.

### M11 — Hors-ligne et souveraineté · `O1, O2, O3`

- [ ] **M11-T1** (O1) Provider `glimmer` local (OpenAI-compatible), chaîne de repli Meta → Glimmer → mock.
- [ ] **M11-T2** (O2) Corpus FR→MG énergie relu par des locuteurs ; essai de fine-tuning Spark Open.
- [ ] **M11-T3** (O3) Étude « kit village autonome » (matériel, coût, consommation du GPU).

### M12 — Outillage et visuel

- [ ] **M12-T1** (I5) Textures 3D générées (toits, terre rouge, rizières), poids dans le budget perf.
- [ ] **M12-T2** (D1, D2) Générateur de scénarios + évals synthétiques (Contributor, données synthétiques seulement).
- [ ] **M12-T3** (I3) Bande dessinée de la journée.

---

## Budget indicatif du sprint

| Poste                                       | Estimation                                                 |
| ------------------------------------------- | ---------------------------------------------------------- |
| Développement et tests (≈ 300 appels Spark) | ≈ 3 $                                                      |
| Transcriptions (≈ 200 × 30 s)               | ≈ 0,30 $                                                   |
| Images (≈ 150 essais)                       | ≈ 1,50 $                                                   |
| Répétitions de démo (20 × parcours complet) | ≈ 2 $                                                      |
| **Total**                                   | **< 10 $** (plafond `META_SPEND_CAP_USD` conseillé : 15 $) |

## Exit criteria (PM)

- Parcours démo enrichi joué de bout en bout sur l'URL publique, avec Meta **et** en mock.
- Chaque commande du chat → dialogue d'approbation avec impact moteur ; aucun changement sans clic.
- Incendie : coupure immédiate, alerte, explication IA, rétablissement seulement après approbation.
- Voix, vision et image : contenu IA visuellement distinct, aucun chiffre hors moteur (tests evidence verts).
- i18n EN/FR/MG à parité, dark/light, 320 px → 4K, `make check` + `make e2e` verts.
