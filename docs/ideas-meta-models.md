# Idées — exploiter au maximum les modèles Meta dans Mitsinjo Grid

> **Statut : banque d'idées, rien n'est implémenté.** Source : catalogue Meta Model API consulté le 2026-10-30.
> Quand une idée est codée, déplacer ce qui devient vrai dans `docs/copilot.md`, `docs/contracts.md`, etc.
> Les noms d'endpoints et les formats d'entrée de SAM, Voice et Image sont **à vérifier** dans la doc Meta avant de coder.

---

## 0. Règle d'or (ne change pas, quelle que soit l'idée)

Toutes les idées ci-dessous respectent les règles non négociables du projet :

1. **Le moteur calcule, l'IA perçoit / explique / propose.** Un modèle peut produire une _observation_
   (« 35 % du panneau est ombragé », « le compteur affiche 1 284 kWh », « le conseil veut garder la lumière le soir »).
   Cette observation devient un **`InputPatch` proposé** ; seul `@mitsinjo/engine` en tire des kW, kWh ou %.
2. **Aucune action sans validation humaine** : l'IA appelle `propose_change`, l'opérateur confirme
   (`ConfirmProposalDialog`). Même pour la maquette physique : l'IA ne commande jamais un disjoncteur directement,
   elle propose → l'opérateur valide → le moteur recalcule → le bridge applique.
3. **Tout contenu IA est visuellement distinct** (texte, image, voix) et étiqueté `SIMULATED DATA` / « Généré par IA ».
4. **Pas de chiffres dans les images générées** : les chiffres sont superposés en HTML depuis le moteur
   (les modèles d'image peuvent mal écrire un nombre).

On peut donc aller très loin en créativité sans casser la promesse « numbers come only from the engine ».

---

## 1. Le catalogue, vu depuis le projet

| Modèle                         | Type                  | Ce qu'il sait faire                                                                | Prix (catalogue)                              | Rôle naturel dans Mitsinjo                                                                       |
| ------------------------------ | --------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Muse Spark 1.3**             | Chat, 1M ctx          | Agentique, appel d'outils natif, MCP, moins de tokens que 1.2                      | 1,25 $ in / 4,25 $ out (par M tok.)           | Copilote par défaut (déjà utilisé)                                                               |
| **Muse Spark 1.1**             | Chat multimodal       | Texte + **images + vidéo + documents**, computer use                               | idem                                          | Lire photos, compteurs, carnets, schémas, vidéo de la maquette                                   |
| **Muse Spark 1.2**             | Chat, code            | Génération / débogage de code, compréhension de codebase                           | idem                                          | Outillage dev (générer scénarios, tests, revues)                                                 |
| **Muse Wonder**                | Chat frontier, 1M     | Tâches longues, **délègue à des sous-agents**, se remet des erreurs, computer use  | 4 $ in / 20 $ out                             | Raisonnement profond, planification 7 jours, multi-agents, audit                                 |
| **Muse Wonder Full**           | Chat                  | Le plus puissant, réponses plus longues                                            | Abonnement Muse Code seulement                | Outil de dev / analyse hors-ligne, pas en prod                                                   |
| **Muse Spark 1.x Contributor** | Chat                  | Même modèle, jusqu'à −95 %, **les données servent à entraîner Meta**               | 0,10 $ in / 0,20 $ out                        | Génération massive de données **synthétiques** (évals, scénarios), jamais de données utilisateur |
| **Muse Image 1.0**             | Image                 | Texte→image, image→image, références, **texte précis**, éditions multi-tours       | 0,01 $ / image                                | Affiches, illustrations de scénario, textures 3D, avant/après                                    |
| **SAM 3.1**                    | Segmentation          | Détecter / segmenter / **suivre** des objets depuis un prompt texte, image + vidéo | 2,50 $ / 1 000 images ; 0,20 $ / 1 000 frames | Panneaux, toits, ombres, nuages, maquette filmée                                                 |
| **Muse Voice Transcribe**      | Audio → texte         | Transcription, **distingue les locuteurs**, détecte début/fin de parole            | 0,18 $ / heure                                | Commande vocale, réunions du village, mains libres                                               |
| **Muse Glimmer**               | Open, 30B, Apache 2.0 | Agents locaux permanents, outils, tâches longues, **1 seul GPU**                   | Gratuit (self-host)                           | Copilote **hors-ligne** au village / sur le PC du bridge                                         |
| **Muse Spark Open**            | Open weights          | Code, raisonnement multimodal, agentique, déployable partout                       | Gratuit (licence Muse)                        | Fine-tuning malgache, déploiement souverain                                                      |

**Manque important :** le catalogue n'a **pas de synthèse vocale (TTS)**. Pour que l'IA « parle », il faut
`speechSynthesis` du navigateur (gratuit, voix FR correctes, **voix malgache quasi inexistante**) ou un service TTS
tiers. Option malgache réaliste : afficher le texte MG + lire en FR, ou pré-enregistrer quelques phrases clés.

**À vérifier dans le playground :** la qualité de Voice Transcribe sur le **malgache** et le français parlé à Madagascar.

---

## 2. Idées par capacité

### 2.1 🎙️ Voix (Muse Voice Transcribe)

| #   | Idée                                    | Description                                                                                                                                                                                                                                                                                 | Effort |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| V1  | **Bouton micro dans le copilote**       | Appui long → enregistre → transcrit → envoyé comme message. Le texte transcrit s'affiche avant envoi (corrigeable).                                                                                                                                                                         | S      |
| V2  | **Mode mains libres (opérateur)**       | La détection début/fin de parole permet un mode « talkie-walkie » : l'opérateur parle, le copilote répond (voix navigateur). Idéal pour la démo mobile.                                                                                                                                     | M      |
| V3  | **Commande vocale de simulation**       | « Simule un nuage pendant deux heures à midi » → `run_scenario(solarDropPct…)`. « Garde au moins la lumière dans le quartier ce soir » → `propose_change(lifeline)`. Toujours confirmation.                                                                                                 | S      |
| V4  | **Réunion du conseil du village**       | On enregistre une réunion (fokonolona). La **diarisation** sépare les intervenants. Wonder résume qui veut quoi, en tire des **priorités sociales** (santé d'abord, école le matin…) et propose un `InputPatch` (priorités, planchers lifeline, plafonds). Le moteur compare l'avant/après. | M      |
| V5  | **Journal vocal de l'opérateur**        | L'opérateur dicte « pompe en panne depuis 14 h », « le marché ferme tôt aujourd'hui ». Le texte devient un événement de scénario proposé (charge eau = 0, marché coupé à 15 h).                                                                                                             | M      |
| V6  | **Ligne téléphonique du village (fou)** | Un numéro (Twilio ou équivalent) : un habitant appelle avec un téléphone basique, pose une question en malagasy, reçoit une réponse vocale. Nécessite un TTS tiers.                                                                                                                         | L      |
| V7  | **Contrôle vocal de la maquette**       | « Fais passer le nuage » → l'IA propose l'événement `solar_drop` → validation → le bridge fait bouger le servo « nuage » et le moteur recalcule. Spectaculaire en démo live.                                                                                                                | M      |

### 2.2 👁️ Vision et documents (Muse Spark 1.3, lit les images)

| #   | Idée                                           | Description                                                                                                                                                                                   | Effort |
| --- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| E1  | **Photo d'un compteur → relevé**               | On photographie un compteur ou un écran d'onduleur. Spark lit la valeur (observation, avec niveau de confiance) → `meterReadings` proposé (le champ existe déjà dans `InputPatch`).           | S      |
| E2  | **Carnet manuscrit → scénario**                | Photo du cahier de l'opérateur (heures de coupure, pannes). Spark extrait un tableau → événements de scénario proposés.                                                                       | M      |
| E3  | **Croquis → village**                          | Le canvas de croquis existe déjà : dessiner le village (maisons, école, puits) → Spark identifie les secteurs et leur nombre → scénario proposé + disposition de la scène 3D.                 | M      |
| E4  | **Photo du ciel → risque nuage**               | Photo/webcam du ciel → Spark estime la couverture nuageuse (« forte, environ 70 % ») → propose un `solarDropPct`. Étiqueté **estimation IA**, le moteur calcule l'effet.                      | S      |
| E5  | **Facture / fiche technique PDF → paramètres** | Fiche technique d'une batterie ou d'un panneau → capacité, puissance max, rendement → patch de configuration proposé (avec source citée).                                                     | M      |
| E6  | **Lecture vidéo de la maquette**               | Une caméra filme la maquette ; Spark vérifie que les LED allumées correspondent à l'état du moteur (« le départ marché devrait être coupé mais sa LED est allumée ») → alerte « à vérifier ». | M      |
| E7  | **Capture d'écran → explication**              | L'utilisateur envoie une capture d'un graphique de l'app : « pourquoi ce creux ? » → Spark repère l'heure, appelle `get_sector_metrics`, explique avec preuves.                               | S      |

### 2.3 ✂️ Segmentation (SAM 3.1)

SAM ne « pense » pas, il **mesure des surfaces et des positions**. Parfait pour fournir des entrées au moteur.

| #   | Idée                                         | Description                                                                                                                                                                                    | Effort |
| --- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| S1  | **Inspection des panneaux**                  | Photo du champ solaire, prompt « solar panel », « leaves », « dust », « shadow ». Ratio pixels ombrés / pixels panneau → proposition de perte (`solarDropPct`). Masques affichés en surcouche. | M      |
| S2  | **Toits → potentiel solaire**                | Image satellite / drone, prompt « roof » → surfaces de toits → nombre de panneaux possibles → le moteur calcule le kWc et la production (extension du dimensionnement).                        | L      |
| S3  | **Recensement des bâtiments**                | Image aérienne, prompts « house », « school », « water tower » → comptage → nombre de ménages et secteurs du scénario.                                                                         | M      |
| S4  | **Suivi du nuage sur la maquette**           | Vidéo de la maquette, prompt « cloud cover » → suivi image par image de la part du panneau couverte → `solar.profile` mesuré en direct (complète le capteur de lumière).                       | M      |
| S5  | **Suivi des « électrons » LED**              | Vérification automatique : SAM suit les points lumineux des bandes LED pour valider la direction et la vitesse du flux vs `flowFactor`. Test matériel automatisé.                              | M      |
| S6  | **Détection de branchements sauvages (fou)** | Photo des poteaux, prompt « illegal wire tap » → zones « à vérifier » (jamais « fraude »), reliées à l'anomalie de PX-anomaly.                                                                 | M      |

### 2.4 🎨 Images (Muse Image 1.0)

| #   | Idée                                         | Description                                                                                                                                                                                                              | Effort |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| I1  | **Affiche de délestage pour le village**     | Après une stratégie validée, générer une affiche **FR/MG** (pictogrammes : école ☀️ matin, puits, lumière le soir) à imprimer ou envoyer sur WhatsApp. Horaires issus du moteur, insérés dans le prompt **et** vérifiés. | M      |
| I2  | **Illustration « le village ce soir »**      | Image du village à 20 h selon le scénario : rues éclairées ou non, clinique allumée. Narration visuelle pour les non-techniciens et le jury.                                                                             | S      |
| I3  | **Bande dessinée de la journée**             | 4 à 6 cases : matin, midi (nuage), après-midi, soir. Édition multi-tours = personnages cohérents. Récit généré depuis les événements du moteur.                                                                          | M      |
| I4  | **Avant / après sur une vraie photo**        | Photo d'un village réel → image→image : ajout de panneaux, batterie, lampadaires. Pour convaincre une communauté ou un financeur (étiqueté « vue d'artiste IA »).                                                        | S      |
| I5  | **Textures et décor 3D**                     | Générer hors-ligne des textures cohérentes (toits en tôle, terre rouge, rizières) pour la scène R3F. Coût : quelques centimes, gros gain visuel.                                                                         | S      |
| I6  | **Pictogrammes pour personnes non lettrées** | Jeu d'icônes générées (pompe, clinique, ampoule, nuage) pour un mode « sans texte » sur mobile.                                                                                                                          | M      |
| I7  | **Rapport illustré du jour**                 | Page de rapport : texte copilote + graphiques moteur + une illustration. Exportable PDF.                                                                                                                                 | M      |

### 2.5 🧠 Raisonnement long et multi-agents (Muse Wonder)

| #   | Idée                                                    | Description                                                                                                                                                                                                                                                                                             | Effort |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| W1  | **Planificateur 7 jours**                               | Wonder lance des dizaines de `run_scenario` / `sweep` (le moteur a déjà `sweep.ts`) sur une semaine (pluie mardi, marché jeudi) et propose un plan jour par jour. Chaque chiffre vient d'un résultat d'outil.                                                                                           | M      |
| W2  | **Conseil des agents de secteur (fou, mais très démo)** | Un sous-agent par secteur : « Clinique », « École », « Marché », « Ménages », « Eau ». Chacun plaide pour sa part ; un agent « Médiateur » cherche un compromis ; **le moteur arbitre** (chaque proposition est simulée, les métriques tranchent). L'UI montre le débat en bulles + la preuve calculée. | L      |
| W3  | **Recherche de stratégie optimale**                     | Wonder explore l'espace des paramètres (planchers, plafonds, priorités) pour un objectif en langage naturel (« zéro coupure clinique, maximum de lumière le soir ») ; le moteur évalue chaque essai ; résultat = front de compromis.                                                                    | M      |
| W4  | **Analyse post-mortem**                                 | « Pourquoi la batterie était vide à 3 h ? » → Wonder remonte la chaîne d'événements avec les pas horaires du moteur et produit une chronologie causale.                                                                                                                                                 | M      |
| W5  | **Red team du copilote**                                | Wonder génère des attaques (injection de prompt, demandes de contrôle physique, chiffres inventés) et vérifie que le copilote Spark respecte les règles. Résultat ajouté aux évals (`eval.cases.ts`).                                                                                                   | M      |
| W6  | **Démo autopilotée par computer use**                   | Wonder pilote le navigateur et joue le parcours démo (baisse solaire → comparaison → explication → preuve) pour la vidéo de soumission ou comme test E2E « intelligent ».                                                                                                                               | M      |

### 2.6 🔌 Contrôle des ressources par l'IA (avec garde-fous)

L'idée : un **autopilote** qui propose une décision chaque heure simulée, mais dans une **enveloppe** fixée par l'humain.

| #   | Idée                                     | Description                                                                                                                                                                                                                                                                         | Effort |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| C1  | **Autopilote « proposer chaque heure »** | À chaque heure de la lecture (ou du suivi maquette), Spark lit l'état (`get_grid_state`) et propose une stratégie/patch. L'opérateur accepte ou refuse d'un tap. Historique des décisions visible.                                                                                  | M      |
| C2  | **Enveloppe d'autonomie**                | L'opérateur définit ce que l'IA peut appliquer **seule en simulation** : ex. « changer de stratégie oui, toucher au plancher clinique jamais, plafond marché entre 0 et 2 kW ». Le moteur vérifie les invariants ; hors enveloppe → confirmation obligatoire. Désactivé par défaut. | L      |
| C3  | **Constitution du village**              | Les règles sociales votées (V4) sont stockées comme « constitution ». Toute proposition IA est vérifiée contre elle **par du code** (pas par le LLM) avant affichage. L'IA explique quelle règle a bloqué une idée.                                                                 | M      |
| C4  | **Boucle maquette complète**             | Maquette physique : capteur lumière + SAM (S4) → moteur → proposition IA → validation → bridge → LED/MOSFET. Le jury voit l'IA « gérer » un vrai circuit, avec un humain dans la boucle.                                                                                            | L      |
| C5  | **Mode « veille de nuit » local**        | Glimmer tourne sur le PC du bridge, sans internet. Il surveille la batterie et prépare des propositions ; au matin, l'opérateur trouve un résumé et des décisions en attente.                                                                                                       | L      |

#### 2.6.1 Contrôle total depuis le chat, avec question d'approbation

**Ce qui existe déjà :** l'outil `propose_change` (`server/copilot/tools.ts`) accepte déjà, par secteur :

| Ce que l'utilisateur dit                   | Champ du patch                           | Effet moteur                    |
| ------------------------------------------ | ---------------------------------------- | ------------------------------- |
| « Coupe le marché de 18 h à 22 h »         | `sectorCaps: {market, maxKw: 0, 18, 22}` | Secteur coupé sur la plage      |
| « Limite l'industrie à 2 kW »              | `sectorCaps: {industry, maxKw: 2, …}`    | « Débit » (puissance) plafonné  |
| « Débranche / rebranche l'industrie »      | `sectorLoads: {industry: 0 / 1}`         | Secteur non connecté / connecté |
| « Garde au moins 0,4 kW pour les ménages » | `lifeline.kw.households`                 | Plancher de survie              |
| « Passe en essentiel d'abord »             | `strategy: essential_first`              | Changement de stratégie         |
| « La clinique passe en priorité critique » | `priorities`                             | Ordre de service                |

Puis `ConfirmProposalDialog` affiche « actuel → proposé » pour chaque champ, avec **Approuver** / **Refuser**.
Rien n'est appliqué sans clic. Le « débit » d'un secteur = sa puissance en kW (le modèle ne gère pas le courant en ampères).

**Ce qu'il manque pour un « contrôle total » :**

| #   | Ajout                                       | Description                                                                                                                                                                                                                                                  | Effort |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| K1  | **Impact chiffré dans la question**         | Avant d'approuver, le dialogue montre ce que le moteur prévoit avec / sans le changement (énergie servie par secteur, SoC batterie, heures coupées), via `compare` sur l'entrée actuelle et l'entrée patchée. L'utilisateur approuve en connaissant le coût. | S      |
| K2  | **« Maintenant » vs « planifié »**          | « Coupe le marché maintenant » = plage qui démarre à l'heure courante de la lecture (ou du suivi maquette). Afficher l'heure retenue dans la question.                                                                                                       | S      |
| K3  | **Plusieurs ordres en une fois**            | « Coupe le marché et l'industrie, garde la clinique » → une seule proposition, un seul dialogue, avec la liste des changements, approuvables **un par un** (cases à cocher).                                                                                 | M      |
| K4  | **Annuler / revenir en arrière**            | Historique des changements approuvés dans la session, bouton « Annuler le dernier » (le moteur recalcule l'état précédent).                                                                                                                                  | S      |
| K5  | **Application à la maquette**               | Une fois approuvé, le patch part au bridge (déjà prévu : le bridge reçoit scénario + patch + stratégie) → MOSFET du secteur coupé ou limité (PWM). Pour la maquette, le dialogue précise « s'applique aussi à la maquette ».                                 | M      |
| K6  | **Refus des ordres dangereux, par du code** | Couper la clinique ou mettre son plancher à 0 → la proposition passe quand même par le dialogue, mais avec un **avertissement rouge** et une seconde confirmation. La règle est codée (pas laissée au LLM).                                                  | S      |

Le prompt garde sa règle : l'IA dit « je propose », jamais « c'est fait ». Exemple de dialogue :

> **Toi :** Coupe le marché ce soir et donne plus à l'école.
> **Copilote :** Je propose : marché à 0 kW de 18 h à 22 h ; école priorité haute. Le moteur prévoit :
> école +1,2 kWh, marché −6,0 kWh, clinique inchangée. _[Approuver] [Refuser]_
> _(chiffres de l'exemple inventés ; dans l'app ils viennent du moteur)_

#### 2.6.2 🔥 Alarme incendie qui coupe le courant

**Faisable, avec une règle de sécurité qui change tout :** en cas de feu, **on n'attend pas l'approbation pour couper**.
Attendre un clic pendant un incendie serait dangereux. Mais la coupure ne doit pas non plus dépendre d'un LLM, d'internet
ou du bridge, qui peuvent être lents ou en panne. Donc :

1. **Couper = réflexe local, automatique, sans IA.** Le capteur déclenche, l'ESP32 ouvre le MOSFET du secteur
   concerné en quelques millisecondes (code firmware déterministe). En simulation, le moteur applique une règle fixe
   « secteur en feu → 0 kW ».
2. **Expliquer et proposer = IA, après coup.** Le copilote alerte, explique ce qui a été coupé, montre l'impact moteur
   (énergie redistribuée aux autres secteurs) et propose la suite : isoler aussi le secteur voisin, garder la clinique
   sur batterie, message d'évacuation.
3. **Remettre le courant = toujours avec approbation humaine** (et capteur revenu au calme). Jamais automatique,
   jamais décidé par l'IA seule.

| #   | Brique                              | Description                                                                                                                                                                                                                                                                                             | Effort |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| F1  | **Événement `fire` dans le moteur** | Nouvel événement de scénario `{ type: 'fire', sector, startHour }` → secteur forcé à 0 kW (prioritaire sur tout : stratégie, plancher de survie), départ en état `cut`, nouvel avertissement `FIRE_ISOLATION`. Test Vitest. Contrat dans `docs/contracts.md`.                                           | M      |
| F2  | **Bouton « Signaler un incendie »** | Sur /simulation et dans le chat : choisir le secteur → coupure immédiate en simulation (exception assumée à l'approbation, car c'est une sécurité). Bannière rouge, son, 3D : bâtiment avec fumée, ligne coupée.                                                                                        | S      |
| F3  | **Détection par la maquette**       | Capteur de fumée/gaz (MQ-2) ou de flamme (IR) par bâtiment sur l'ESP32 → coupure locale immédiate du MOSFET → message MQTT `fire` au bridge → l'app affiche l'alerte. Démo : une allumette ou une LED IR près du capteur.                                                                               | M      |
| F4  | **Détection par caméra (IA)**       | SAM 3.1 sur la vidéo, prompts « fire », « smoke » ; Spark 1.3 confirme sur l'image. Pour l'IA, c'est une **alerte à vérifier** : elle propose la coupure avec un dialogue « Incendie détecté à l'école ? Couper ? » (pas de coupure automatique sur une simple estimation IA, risque de fausse alarme). | M      |
| F5  | **Signalement à la voix**           | « Au feu à l'école ! » → Voice Transcribe → le copilote reconnaît l'urgence → ouvre directement le dialogue de coupure, bouton « Couper » mis en avant. Une phrase = un clic.                                                                                                                           | S      |
| F6  | **Après l'incendie**                | Le copilote résume (heure, secteur, énergie non servie calculée par le moteur), Muse Image génère une affiche « consignes incendie » FR/MG, et la remise sous tension passe par le dialogue d'approbation.                                                                                              | S      |

**Règle à écrire dans le prompt et dans le code :**

| Source de l'alarme                       | Coupure                              | Remise sous tension |
| ---------------------------------------- | ------------------------------------ | ------------------- |
| Capteur physique (fumée, flamme)         | Automatique, locale, immédiate       | Approbation humaine |
| Bouton « Signaler un incendie » (humain) | Automatique (l'humain a déjà décidé) | Approbation humaine |
| Voix (« au feu ! »)                      | Dialogue pré-rempli, un clic         | Approbation humaine |
| Caméra + IA (SAM / Spark)                | Dialogue « à vérifier », un clic     | Approbation humaine |

Tout reste **simulé** : les libellés le disent. Dans un vrai village, la protection incendie relève de vrais équipements
certifiés (disjoncteurs, détecteurs), pas d'une application. La maquette montre le principe.

### 2.7 🌍 Hors-ligne et souveraineté (Glimmer, Spark Open)

| #   | Idée                           | Description                                                                                                                                                                                                                            | Effort |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| O1  | **Provider `glimmer` local**   | Nouveau provider dans `server/copilot/providers/` (API compatible OpenAI via vLLM/Ollama). Bascule automatique : Meta cloud → Glimmer local → mock déterministe. Argument fort : un village rural n'a souvent pas de connexion fiable. | M      |
| O2  | **Fine-tuning malgache**       | Avec Spark Open : petit fine-tuning sur un corpus FR→MG du vocabulaire énergie (validé par des locuteurs). Débloque le MG « reviewed » prévu dans le prompt.                                                                           | L      |
| O3  | **Kit village autonome (fou)** | Une boîte : mini-PC GPU + ESP32 + bridge + Glimmer + app locale. Arrive au village, marche sans internet. La maquette devient un prototype de produit.                                                                                 | XL     |

### 2.8 🛠️ Outillage dev (Spark 1.2, Contributor, Wonder Full)

| #   | Idée                              | Description                                                                                                                                       |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Générateur de scénarios**       | Spark 1.2 écrit de nouveaux scénarios Zod-valides (saison des pluies, cyclone, fête du village) + leurs tests.                                    |
| D2  | **Évals synthétiques à bas coût** | Contributor (−95 %) génère des centaines de questions d'évaluation **synthétiques** (jamais de données réelles : elles servent à entraîner Meta). |
| D3  | **Relecture i18n malgache**       | Spark propose des traductions MG manquantes, marquées « à relire » ; un humain valide.                                                            |
| D4  | **Revue de PR**                   | Wonder Full (abonnement) relit une PR contre `CLAUDE.md` et les règles.                                                                           |

---

## 3. Idées les plus folles (pour impressionner le jury)

1. **« Le village parle à son réseau »** — Une habitante dit en malagasy : « Ce soir il y a une veillée à l'école. »
   Voice transcrit → Spark comprend un besoin (école 19–23 h) → propose un patch → le moteur montre le coût
   (qui perd quoi) → le conseil des agents (W2) débat → l'opérateur valide → **la maquette allume l'école** →
   Muse Image génère l'affiche de la veillée avec l'horaire.
2. **Jumeau numérique depuis une seule photo** — Une photo aérienne : SAM compte maisons et toits, Spark classe les
   secteurs, Wonder construit le scénario, la scène 3D se réorganise, le moteur dimensionne le champ solaire.
3. **Météo par les yeux** — Une webcam regarde le ciel + la maquette ; SAM suit les nuages ; l'IA anticipe la baisse
   et **propose avant qu'elle arrive** de recharger la batterie ou de décaler la pompe.
4. **Débat en direct des secteurs** — Bulles de chat de 5 agents avec avatars générés (Muse Image), chiffres moteur
   en badges ; le jury peut prendre parti à la voix (« je soutiens l'école ») et voir l'arbitrage recalculé.
5. **Simulation « une année en 60 secondes »** — Wonder planifie 365 jours (sweeps), Muse Image génère une image
   par saison, le tout monté en timelapse avec la courbe de batterie du moteur.
6. **Mode enfant à l'école** — Les élèves posent des questions à voix haute (« pourquoi la lumière s'éteint ? ») ;
   réponses simples + dessin généré ; la maquette montre l'effet en vrai.

---

## 4. Architecture proposée (extension de l'existant)

```text
server/
├── copilot/
│   ├── adaptive-router.ts     # ÉTENDRE : routes vers spark-1.3 / spark-1.1 (média) / wonder / glimmer
│   ├── providers/glimmer.ts   # NOUVEAU : local OpenAI-compatible (O1)
│   └── tools.ts               # NOUVEAUX outils (ci-dessous)
├── perception/                # NOUVEAU : modèles non-chat, tous server-only
│   ├── transcribe.ts          # Voice Transcribe → { text, speakers[], segments[] }
│   ├── segment.ts             # SAM 3.1 → { masks[], areaRatio, count }
│   └── vision.ts              # Spark 1.3 → observations structurées (Zod)
└── media/
    └── generate-image.ts      # Muse Image (affiches, illustrations), stockage R2 existant
app/api/
├── voice/route.ts             # audio → texte (upload R2 existant réutilisé)
├── perception/route.ts        # image/vidéo → observations
└── visual/route.ts            # génération d'image
```

**Nouveaux outils copilote** (même discipline Zod + preuve que les outils actuels) :

| Outil                    | Entrée                  | Sortie                                              | Règle                                                                   |
| ------------------------ | ----------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| `analyze_image`          | `mediaKey`, `question`  | `observations[]` (valeur, unité, confiance, source) | Observation ≠ résultat moteur ; affichée dans un bloc « Perception IA » |
| `segment_image`          | `mediaKey`, `prompts[]` | `count`, `areaRatio`, `maskKey`                     | Mesure géométrique uniquement                                           |
| `observation_to_patch`   | `observations[]`        | `InputPatch` proposé                                | Passe toujours par `propose_change`                                     |
| `generate_visual`        | `kind`, `resultId`      | `imageKey`                                          | Pas de chiffres dans l'image ; chiffres en surcouche HTML               |
| `simulate_week` (Wonder) | `days[]` d'événements   | métriques par jour                                  | Appelle le moteur, rien d'autre                                         |

**Nouveaux événements SSE** : `perception` (observations + confiance), `media` (image générée), `transcript`.
**UI** : trois couleurs de blocs distinctes — _Calcul moteur_ (preuve), _Perception IA_ (estimation), _Texte IA_.

---

## 5. Coûts indicatifs (prix du catalogue)

| Action                               | Hypothèse              | Coût approx. |
| ------------------------------------ | ---------------------- | ------------ |
| Tour de copilote Spark 1.3           | 6 000 tok. in, 600 out | ≈ 0,01 $     |
| Tour de copilote Wonder              | 6 000 in, 600 out      | ≈ 0,04 $     |
| Conseil de 5 agents Wonder, 3 tours  | ≈ 15 appels            | ≈ 0,60 $     |
| Commande vocale 30 s                 | Voice Transcribe       | ≈ 0,0015 $   |
| Réunion de 1 h                       | Voice Transcribe       | 0,18 $       |
| Affiche ou illustration              | Muse Image             | 0,01 $       |
| Inspection d'une photo               | SAM image              | 0,0025 $     |
| 1 min de vidéo maquette à 5 images/s | SAM vidéo, 300 frames  | ≈ 0,06 $     |

→ Une démo complète, même avec toutes les idées, reste **sous 1 $**. Le prompt caching (0,15 $ / M) réduit encore
le coût du prompt système. Prévoir un plafond de dépense et le mock déterministe en secours (déjà en place).

---

## 6. Priorités pour le hackathon (impact démo / effort)

**Niveau 1 — à faire en premier (1 à 2 jours, gros effet) :**

- **V1 + V3** micro dans le copilote → commandes de simulation à la voix.
- **E1 / E4** photo (compteur ou ciel) → observation → patch proposé → moteur.
- **I2 + I1** illustration « le village ce soir » et affiche de délestage FR/MG.
- Étendre `adaptive-router.ts` : média → Spark 1.3 (vision), « planifie / pourquoi en profondeur » → Wonder.
- **K1 + K6** impact chiffré et avertissement clinique dans la question d'approbation.
- **F1 + F2** événement incendie dans le moteur et bouton « Signaler un incendie ».

Ces quatre points enrichissent le parcours démo sans le casser :
_baisse solaire (dite à la voix ou vue sur photo du ciel) → comparaison → explication IA (lue à voix haute) →
preuve calculée → affiche générée pour le village._

**Niveau 2 — effet « waouh » :**

- **W2** conseil des agents de secteur, **V4** réunion du village → priorités, **S1** inspection des panneaux.
- **V7 / C4** boucle vocale avec la maquette physique (après H5).

**Niveau 3 — vision produit (à montrer en slide, pas forcément codé) :**

- **O1 / O3** Glimmer hors-ligne et kit village autonome, **O2** fine-tuning malgache, **S2** dimensionnement par satellite.

---

## 7. Risques et parades

| Risque                                     | Parade                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Le modèle lit mal un chiffre sur une photo | Champ `confidence`, valeur affichée et **modifiable** avant de proposer le patch                 |
| Transcription malagasy faible              | Tester tôt dans le playground ; afficher le texte avant envoi ; repli clavier                    |
| Pas de TTS dans le catalogue               | `speechSynthesis` navigateur (FR/EN) ; MG en texte seulement au début                            |
| Image avec un faux chiffre                 | Interdire les chiffres dans le prompt image ; superposer les chiffres moteur en HTML             |
| L'IA semble « contrôler » un vrai réseau   | Libellés SIMULATED, `propose_change` obligatoire, enveloppe désactivée par défaut, refus en éval |
| Données envoyées aux modèles Contributor   | Contributor uniquement pour du synthétique (dev/évals), jamais pour des messages utilisateur     |
| Latence (Wonder, multi-agents)             | Streaming SSE des étapes, budget de temps, repli Spark ; résultats moteur mis en cache           |
| Coût qui dérape                            | Plafond par session, cache `inputHash+strategy` existant, mock en secours                        |
| Vie privée (voix, photos de personnes)     | Ne pas stocker l'audio par défaut ; flouter les visages via SAM avant stockage R2                |
