# Maquette physique — jumeau miniature du micro-réseau

> **Statut : étude de conception, rien n'est implémenté.** Ce document décrit comment construire une maquette
> basse tension qui reproduit, à l'échelle, tous les éléments de la scène 3D, et comment la relier au projet.
> Quand une partie est codée, déplacer ce qui devient vrai dans `docs/contracts.md`, `docs/architecture.md`
> et `docs/engine-spec.md`, et garder ici seulement la partie matérielle.

---

## 0. Réponses courtes

| Question                            | Réponse                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Le projet est-il déjà adapté ?      | **En partie.** Le moteur est pur, déterministe, rapide (< 10 ms) et accepte déjà des mesures (`meterReadings`, `sectorLoads`, `initialSocPct` via `InputPatch`). La 3D lit un `SceneModel` (disjoncteurs, intensité, flux) qu'on peut aussi envoyer à une maquette. **Il manque** : flux temps réel, mesure du solaire, sortie de commandes, service local. |
| Peut-on le lier à un vrai circuit ? | **Oui**, en deux sens : (1) **rejeu** : le moteur décide, la maquette applique (LED, pompe, disjoncteurs) ; (2) **jumeau** : la maquette mesure (lumière sur le panneau, demande), le moteur recalcule, la maquette applique. Commencer par (1).                                                                                                            |
| Faut-il un service à part ?         | **Oui, un petit « bridge » local** (`apps/bridge`, Node/TS). L'app Next est déployée sur Vercel (serverless) : pas de port série, pas de connexion MQTT permanente. Le bridge reçoit les mesures, les met à l'échelle, appelle `@mitsinjo/engine` et renvoie les consignes. Il **ne calcule aucune valeur d'énergie** lui-même.                             |
| Comment réaliser le circuit ?       | ESP32 + panneau 12 V 10 W + batterie LiFePO4 12,8 V + capteurs INA3221 + 6 départs MOSFET (un par secteur) + bande LED adressable pour les « électrons ». Tout en très basse tension (≤ 13 V DC). Détails § 5.                                                                                                                                              |

---

## 1. Ce que la maquette doit reproduire (inventaire de la scène 3D)

Chaque élément de `apps/web/src/features/microgrid-3d/ui/` a un équivalent physique :

| Élément 3D (fichier)                                                                       | Équivalent maquette                                                       | Piloté par (champ moteur / SceneModel)                       |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Champ solaire (`solar-array.tsx`)                                                          | Panneau 12 V 10 W + capteur de lumière de référence + cache « nuage »     | Mesure → `solar.profile` ; `solarKw` affiché                 |
| Batterie (`battery-unit.tsx`)                                                              | Batterie LiFePO4 + jauge 10 LED (SoC)                                     | `socPct`, `batteryKw` (charge / décharge)                    |
| Contrôleur / EMS (`dispatch-controller-unit.tsx`)                                          | Boîtier avec ESP32, écran OLED, 6 LED d'état disjoncteur                  | `controller.mode`, `feeders[s].breaker`                      |
| Barre de répartition (`dispatch-share-bar.tsx`)                                            | Bargraph 6 couleurs sur l'OLED                                            | `feeders[s].share`                                           |
| Lignes + électrons (`distribution-lines.tsx`, `electron-flow.tsx`)                         | Bande WS2812B le long de chaque ligne, animation de points                | `flowFactor(flowKw)`, `WireState` (`flow/lifeline/cut/idle`) |
| Étiquettes de départ (`feeder-tags.tsx`)                                                   | Petites étiquettes imprimées + valeur kW sur l'OLED                       | `feeders[s].servedKw`                                        |
| Santé, eau, école, ménages, marché, industrie (`building-bodies.tsx`, `village-house.tsx`) | Bâtiments imprimés 3D / carton, chacun avec sa charge réelle (voir § 4.3) | `sectors[s].servedKw`, `mode`, `intensity`                   |
| Lampadaires (`pole-lamps`, `mapPolesToSectors`)                                            | LED 3 mm sur poteaux, câblées sur le départ du secteur                    | même départ que le secteur (coupé = éteint)                  |
| Météo / ciel (`weather-effects.tsx`, `sky-backdrop.tsx`)                                   | Lampe « soleil » dimmable + servo qui fait passer un cache « nuage »      | `weather`, événement `solar_drop`                            |
| Véhicules, végétation, terrain                                                             | Décor statique (non électrique)                                           | —                                                            |

---

## 2. Mise à l'échelle (le cœur du sujet)

La maquette ne fait pas passer 40 kW : elle fait passer quelques watts. On définit **deux facteurs** et on s'y tient.

### 2.1 Facteur de puissance `kP`

**Proposition : `kP = 4000` → 1 W sur la maquette = 4 kW dans la simulation.**

| Élément (valeurs par défaut `engine-spec.md` § 5) | Réel simulé  | Maquette (÷ 4000) | Courant à 12 V |
| ------------------------------------------------- | ------------ | ----------------- | -------------- |
| Champ PV                                          | 40 kWc       | 10 W              | 0,83 A         |
| Batterie, puissance max                           | ± 25 kW      | ± 6,25 W          | 0,52 A         |
| Santé (jour / nuit)                               | 1,2 / 0,6 kW | 0,30 / 0,15 W     | 25 / 12 mA     |
| Eau (pompe 08–16 h)                               | 3 kW         | 0,75 W            | 62 mA          |
| École                                             | 1,5 kW       | 0,375 W           | 31 mA          |
| Ménages (pic 18–22 h)                             | 6 kW         | 1,5 W             | 125 mA         |
| Marché                                            | 2 kW         | 0,5 W             | 42 mA          |
| Industrie (si connectée)                          | ≈ 8 kW       | 2 W               | 167 mA         |
| Plancher lifeline le plus petit (école, marché)   | 0,1 kW       | 25 mW             | 2 mA           |

Pic de demande total ≈ 2 W hors industrie → un bus 12 V à moins de 0,5 A suffit. Les INA3221 (résolution ≈ 40 µA
avec un shunt 0,1 Ω) mesurent sans problème le plus petit plancher (2 mA).

Un facteur **unique** pour tout le monde garde l'histoire simple et honnête (« 1 W = 4 kW »). Si une charge est
trop faible pour être visible (santé la nuit), on ajuste l'**apparence** (LED plus efficace), jamais le facteur.

### 2.2 Facteur de temps `kT`

Le moteur travaille sur 24 pas d'1 h. Une démo ne dure pas 24 h.

**Retenu : `kT = 20` par défaut → 1 h simulée = 20 s réelles, une journée = 8 min ; réglable à chaud dans l'app (60 / 20 / 10 / 5 s).** Pour une démo courte : `kT = 120`
(30 s par heure, journée en 12 min). Configurable dans le bridge.

### 2.3 Conséquence : la batterie de la maquette n'est **pas** la batterie simulée

L'énergie se met à l'échelle avec `kE = kP × kT`. Avec `kP = 4000` et `kT = 60` : `kE = 240 000`, donc
120 kWh simulés ↔ **0,5 Wh** physiques. Aucune vraie batterie ne se comporte proprement à cette taille, et
compresser le temps fausse sa chimie.

Décision recommandée :

- La batterie physique est un **réservoir tampon** qui alimente la maquette (elle reste toujours entre 30 et 90 %).
- Le **SoC affiché** (jauge LED, OLED, 3D) est **celui du moteur** (`socPct`), pas celui de la batterie physique.
- La tension / le courant de la batterie physique sont mesurés uniquement pour la **sécurité** (coupure si < 12,0 V)
  et le diagnostic, jamais comme valeur affichée du micro-réseau.

C'est cohérent avec la règle du projet : **les chiffres viennent uniquement de `@mitsinjo/engine`.**

### 2.4 Conversion des mesures en entrées moteur

Les mesures sont des **entrées** (comme un curseur), pas des résultats. La conversion est codée dans le moteur
(`packages/engine/src/hardware/`, `scaleTelemetry`, testée) ; le bridge ne fait que de la plomberie :

```text
solarProfile[h]     = profil_base[h] × clamp( lux_moyen[h] / luxFullSun , 0, 1 )   (lampe pleine = ciel clair)
meterReadings[s][h] = demande_attendue_s[h] × demande_moyenne_s[h]   (interrupteur 0–1)
heures non mesurées = profil de base et demande attendue (prévision)
```

`demande_attendue` = `computeProfileDemandKw` du moteur (profil × charge × multiplicateur × pics), donc un secteur
allumé reproduit exactement le scénario. `lux_moyen[h]` = moyenne des échantillons reçus pendant la fenêtre réelle
de l'heure simulée `h` (`kT` secondes). Le facteur `kP` ne sert qu'en sortie (rapport cyclique, § 3).
Couper un secteur fait diverger ses relevés du profil attendu : l'alerte `ANOMALY_TO_VERIFY` peut alors apparaître.

---

## 3. Deux modes de liaison

### Mode A — « Rejeu » (moteur → maquette). **À faire en premier.**

```text
 Scénario / curseurs (web) ──► engine.compare() ──► résultat de la stratégie active
                                                         │  par heure : served_s, mode, socPct, flux
                                                         ▼
                                              bridge ──► MQTT ──► ESP32 ──► MOSFET / LED / pompe
```

- Aucune mesure nécessaire : la maquette **montre** la simulation (comme la 3D, mais en vrai).
- Rapport cyclique PWM du départ `s` = `servedKw_s / nominalKw_s` (valeurs moteur, `toHardwareCommand`).
- Disjoncteur ouvert / limité / fermé = `feeders[s].breaker` du `SceneModel`.
- Sans risque pour la démo : si la maquette est débranchée, le web continue tel quel.

### Mode B — « Jumeau » (maquette → moteur → maquette)

```text
 lampe « soleil » + cache nuage ─► capteur lux ─┐
 interrupteurs / potentiomètres « demande » ────┼─► ESP32 ─► MQTT ─► bridge ─► InputPatch ─► engine.compare()
                                                │                                              │
                       MOSFET / LED / pompe ◄───┴──── consignes (mode A) ◄──────────────────────┘
```

Démo phare : on **passe la main ou le cache « nuage » devant le panneau** → le solaire mesuré chute → le moteur
recalcule → les stratégies divergent → le copilote explique → les maisons du « mauvais » côté baissent réellement
sur la maquette. C'est exactement le parcours démo (_solar drop → comparaison → explication IA → preuve_), en physique.

### Piège à éviter en mode B : demande ≠ courant mesuré

Quand le moteur rationne un secteur, le MOSFET réduit son courant. Si l'on prenait ce courant comme « demande »,
la demande baisserait toute seule et la boucle s'effondrerait.

- **Demande** = ce que le secteur _demande_ : position d'un interrupteur ou potentiomètre par secteur
  (× puissance nominale maquette). C'est l'entrée.
- **Courant mesuré après le MOSFET** = ce qui est _servi_. Il sert à **vérifier** que la maquette applique bien la
  consigne (écart > 25 % → afficher un défaut matériel), jamais à alimenter `meterReadings`.

Même logique pour le solaire : la puissance du panneau dépend de l'état de charge (régulateur qui écrête quand la
batterie est pleine). On mesure donc l'**ensoleillement** avec un capteur de référence (BH1750 ou petite cellule
en court-circuit), pas la puissance du panneau.

---

## 4. Architecture logicielle proposée

### 4.1 Pourquoi un service séparé

| Contrainte                                                                             | Conséquence                                                       |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Next.js est déployé sur Vercel (fonctions serverless, 20 s)                            | Pas de connexion MQTT / série permanente côté serveur web         |
| Le navigateur ne parle pas MQTT TCP ni au port USB (sauf Web Serial, Chrome seulement) | Un intermédiaire local est plus fiable                            |
| La salle de démo peut ne pas avoir Internet                                            | Tout doit tourner en local (portable + point d'accès Wi-Fi)       |
| Règle « numbers only from engine »                                                     | Le bridge **importe** `@mitsinjo/engine`, il ne réimplémente rien |

Donc : un nouveau paquet du monorepo **`apps/bridge`** (codé en H3, `make bridge` / `make bridge-sim` ; configuration et fonctionnement : `docs/bridge.md`) (Node 22, TS strict, dépendances : `@mitsinjo/engine`, `zod`,
`mqtt`, `ws`, optionnel `serialport`). Pas de NestJS, pas de Python : même pile que le reste.

### 4.2 Vue d'ensemble

```text
┌────────────── maquette ──────────────┐        ┌──────────── portable (local) ────────────┐
│ ESP32 ── INA3221 ×3, BH1750 (I²C)    │  MQTT  │ broker aedes intégré (:1883)             │
│   │      MOSFET ×6 (PWM)             │◄──────►│ apps/bridge                              │
│   │      WS2812B (flux), OLED, servo │        │   • valide TelemetryFrame (Zod)          │
│   └─ Wi-Fi (ou USB série en secours) │        │   • agrège par heure simulée (kT)        │
└──────────────────────────────────────┘        │   • construit InputPatch → engine        │
                                                │   • publie HardwareCommand               │
                                                │   • WebSocket :8787 → navigateur         │
                                                └───────────────┬──────────────────────────┘
                                                                │ ws://localhost:8787
                                                ┌───────────────▼──────────────────────────┐
                                                │ apps/web (make dev)                      │
                                                │   features/hardware-link (hook + badge)  │
                                                │   store : source = 'scenario' | 'device' │
                                                └──────────────────────────────────────────┘
```

Version déployée (optionnelle, plus tard) : le bridge envoie un `POST /api/hardware/telemetry` (jeton
`HARDWARE_TOKEN`) et l'app lit la dernière trame stockée (Neon, déjà présent dans `server/db/`). Le temps réel
strict reste en local.

### 4.3 Contrats (codés en H1)

`HardwareScale`, `TelemetryFrame`, `TelemetrySample`, `HardwareCommand` sont des schémas Zod dans
`packages/engine/src/schemas/hardware.ts`, décrits dans `docs/contracts.md` § Physical scale model. Une commande
porte, par départ, `duty` (0–1), `breaker` et `flow` (0–1) ; le firmware les applique sans rien calculer.

### 4.4 Ce qu'il faut changer dans le projet existant

| Zone                                    | Changement                                                                                                                                                                         | Skill                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `packages/engine/src/schemas/input.ts`  | ✅ fait (H1) : `InputPatch.solarProfile?: number[24]` (0–1)                                                                                                                        | `/engine-change`                |
| `packages/engine/src/hardware/`         | ✅ fait (H1) : `scaleTelemetry`, `toHardwareCommand`, `DEFAULT_HARDWARE_SCALE` (§ 2.4)                                                                                             | `/engine-change`                |
| `features/microgrid-3d/utils/`          | ✅ fait (H2) : disjoncteur, mode du contrôleur et courbe de flux déplacés dans `packages/engine/src/dispatch/`, réutilisés par la 3D. couleur `feederTone` aussi (H2-T2)           | `/scene-3d`                     |
| `stores/simulation.store.ts`            | `source: 'scenario' \| 'device'`, `simHour` piloté par le bridge en mode B                                                                                                         | `/ui-feature`                   |
| `features/hardware-link/`               | `useHardwareLink()` (WebSocket, reconnexion, état), badge « Maquette connectée », panneau calibration                                                                              | `/ui-feature` + `/design-check` |
| `messages/{en,fr,mg}.json`              | Libellés : badge, états, label « DONNÉES MAQUETTE — 1 W = 4 kW » à côté de `SIMULATED DATA`                                                                                        | `make check-i18n`               |
| `server/copilot/`                       | Le copilote reçoit `source: 'device'` dans `get_grid_state` pour dire « mesuré sur la maquette »                                                                                   | `/copilot-tool`                 |
| `Makefile`, `.env.example`, `README.md` | `make bridge`, `make bridge-sim`, `make mqtt`, `make firmware-flash` ; `MQTT_URL`, `BRIDGE_WS_PORT`, `NEXT_PUBLIC_BRIDGE_URL`, `HARDWARE_TOKEN`, `HW_POWER_SCALE`, `HW_TIME_SCALE` | règle maintenance               |

### 4.5 Simulateur de maquette (indispensable)

`make bridge-sim` lance un **faux ESP32** (même `TelemetryFrame`, lumière qui suit le profil solaire, bouton
« nuage » au clavier). Il permet de développer et de tester (Vitest + Playwright) sans matériel, et de garder le
parcours démo vivant si la maquette tombe en panne le jour J.

### 4.6 Sécurité de fonctionnement (firmware)

- **Chien de garde** : pas de `HardwareCommand` depuis 5 s → mode secours local : départs santé et eau fermés à leur
  plancher lifeline, les autres ouverts, LED contrôleur orange clignotante.
- Tension batterie < 12,0 V → tout couper sauf ESP32 ; > 14,6 V → couper la charge (le BMS le fait aussi).
- Les commandes sont bornées dans le firmware (`duty` 0–1) même si le bridge se trompe.

---

## 5. Réalisation du circuit

Tout est en **très basse tension continue (≤ 14,6 V)**. Aucun secteur 230 V sur la maquette (la lampe « soleil »
est un appareil du commerce, à part).

### 5.1 Nomenclature (prix indicatifs, à vérifier)

| #   | Composant                                                                                                     | Qté | Rôle                                        | ≈ prix |
| --- | ------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------- | ------ |
| 1   | ESP32-DevKitC (WROOM-32)                                                                                      | 1   | Contrôleur / EMS, Wi-Fi, PWM, I²C           | 8 €    |
| 2   | Panneau solaire 12 V, 10 W (Vmp ≈ 18 V)                                                                       | 1   | Champ PV                                    | 20 €   |
| 3   | Régulateur de charge solaire 12 V compatible LiFePO4 (petit PWM 5–10 A, ou module MPPT 4S)                    | 1   | Charge batterie                             | 10 €   |
| 4   | Batterie LiFePO4 12,8 V 3–6 Ah avec BMS 4S intégré                                                            | 1   | Réservoir tampon                            | 25 €   |
| 5   | Module INA3221 (3 voies, I²C, shunt 0,1 Ω)                                                                    | 3   | 9 voies : PV, batterie, 6 départs, 1 libre  | 3×4 €  |
| 6   | BH1750 (luxmètre I²C)                                                                                         | 1   | Ensoleillement de référence                 | 3 €    |
| 7   | MOSFET canal N logique (IRLZ44N, ou modules « MOSFET PWM » prêts) + résistance grille 100 Ω + pull-down 10 kΩ | 6   | Disjoncteur / variateur par départ          | 6 €    |
| 8   | Convertisseur abaisseur 12 → 5 V, 3 A (MP1584 / LM2596)                                                       | 1   | ESP32, WS2812, servo                        | 3 €    |
| 9   | Bande WS2812B 60 LED/m, 2 m                                                                                   | 1   | « Électrons » sur les lignes                | 10 €   |
| 10  | OLED SSD1306 0,96″ I²C                                                                                        | 1   | Écran du contrôleur                         | 4 €    |
| 11  | Servo SG90 + cache en carton                                                                                  | 1   | « Nuage » (événement `solar_drop` physique) | 3 €    |
| 12  | Mini pompe 12 V (ou 5 V + buck) + petit réservoir                                                             | 1   | Secteur eau                                 | 6 €    |
| 13  | Mini moteur DC + hélice                                                                                       | 1   | Secteur industrie                           | 2 €    |
| 14  | Bande LED 12 V blanc chaud (découpée), LED 3 mm + résistances                                                 | lot | Maisons, école, santé, marché, lampadaires  | 8 €    |
| 15  | Interrupteurs à levier ×6 ou potentiomètres 10 kΩ ×6 (+ ADS1115 si potentiomètres)                            | 6   | Demande par secteur (mode B)                | 6–10 € |
| 16  | Fusible général 3 A + porte-fusible, polyfuses 0,5 A ×6, interrupteur général, diodes 1N5819 (moteurs)        | lot | Protection                                  | 6 €    |
| 17  | Borniers, plaque pastillée ou PCB, fils 0,5 mm², socle bois/MDF 60 × 40 cm, impressions 3D des bâtiments      | lot | Montage                                     | 20 €   |

Total ≈ 160–190 € hors outillage et lampe.

### 5.2 Schéma bloc

```text
          ☀ lampe + cache servo
                  │
          ┌───────▼───────┐       BH1750 (lux, I²C)
          │ Panneau 10 W  │
          └───────┬───────┘
                  │ INA3221-A voie 1 (PV)
          ┌───────▼────────┐
          │ Régulateur     │───────── Batterie LiFePO4 12,8 V (BMS)
          │ solaire 12 V   │            │ INA3221-A voie 2 (batterie)
          └───────┬────────┘            │
                  └──────┬──────────────┘
                     Fusible 3 A ── Interrupteur général
                         │
                ══════ BUS 12 V ══════════════════════════════════════════════
                  │          │         │          │         │         │       │
               Buck 5V   polyfuse   polyfuse   polyfuse  polyfuse  polyfuse  polyfuse
                  │          │         │          │         │         │       │
               ESP32      Santé      Eau       École    Ménages    Marché  Industrie
               OLED       LED+croix  pompe     LED      bande LED  guirl.  moteur
               WS2812     lampad.    lampad.   lampad.  lampad.    lampad. lampad.
               Servo         │         │          │         │         │       │
                          ── charges côté + ; retour (−) par MOSFET bas côté ──
                           Q1 ─ INA3221-B v1 … Q6 ─ INA3221-C v3 ── GND commun
```

### 5.3 Un départ (à répéter 6 fois)

```text
 +12 V bus ── polyfuse 0,5 A ── shunt INA3221 (IN+ → IN−) ── CHARGE (+)
                                                              CHARGE (−) ── Drain  Q (IRLZ44N)
                                                                           Source ── GND
 ESP32 GPIO (PWM 1 kHz, 10 bits) ── 100 Ω ── Gate Q
                                             Gate ── 10 kΩ ── GND   (Q bloqué au démarrage)
 Charge inductive (pompe, moteur) : diode 1N5819 en antiparallèle sur la charge.
```

- `duty = 0` → disjoncteur **ouvert** (`cut`, lampadaires éteints).
- `0 < duty < 1` → **limité** ou **lifeline** (LED faibles, pompe lente).
- `duty = 1` → **fermé**.
- Le shunt est côté + (haut) pour que l'INA3221 mesure aussi la tension de la charge.

### 5.4 Affectation des broches ESP32 (proposition)

| Fonction                       | GPIO                   | Remarque                                                            |
| ------------------------------ | ---------------------- | ------------------------------------------------------------------- |
| I²C SDA / SCL                  | 21 / 22                | INA3221 ×3 (0x40, 0x41, 0x42), BH1750 0x23, OLED 0x3C, ADS1115 0x48 |
| PWM départs santé…industrie    | 25, 26, 27, 32, 33, 13 | LEDC, 1 kHz, 10 bits                                                |
| WS2812B (données)              | 4                      | Résistance série 330 Ω, condensateur 1000 µF sur le 5 V             |
| Servo « nuage »                | 18                     | 50 Hz                                                               |
| Interrupteurs demande (mode B) | 14, 15, 16, 17, 19, 23 | Pull-up internes ; ou potentiomètres via ADS1115                    |
| LED « lien perdu »             | 2                      | LED de la carte                                                     |

Éviter les GPIO 0, 2 (au boot), 6–11 (flash) et 34–39 pour les sorties (entrées seulement).

### 5.5 Correspondance visuelle avec la 3D

- **Flux sur les lignes** : chaque ligne = un segment WS2812B. Vitesse et densité des points = `flow` (0–1) reçu,
  qui vient de `flowFactor(flowKw)` (même fonction que `electron-flow.tsx`, une fois extraite dans le paquet partagé).
  `lifeline` = points ambre espacés, `cut` = segment éteint, `idle` = gris très faible.
- **Couleurs** : reprendre la palette des tons de départ (`feederTone`) côté bridge et envoyer des RVB ; le firmware
  ne choisit aucune couleur. Les couleurs LED sont du matériel, pas de l'UI : la règle « pas de hex dans le JSX »
  ne s'applique pas au firmware, mais la source de vérité reste la palette du web.
- **Batterie** : jauge 10 LED = `socPct` du moteur ; LED verte qui défile vers la batterie en charge
  (`batteryKw > 0`), vers le bus en décharge.

### 5.6 Calibration (une fois par lieu de démo)

1. Lampe « soleil » à pleine puissance, cache ouvert → noter `lux` = `luxFullSun`.
2. Chaque départ à `duty = 1`, interrupteur demande à 1 → noter la puissance mesurée = `nominalW[s]`.
   Ajuster les résistances/LED pour approcher les valeurs du tableau § 2.1.
3. Vérifier chaque départ à `duty = 0,5` : la puissance mesurée doit être ≈ 50 % (sinon, linéariser dans le bridge).
4. Enregistrer `HardwareScale` dans un fichier JSON local (`apps/bridge/calibration.json`, gitignoré).

---

## 6. Firmware ESP32 (résumé)

- PlatformIO + framework Arduino ; bibliothèques : `PubSubClient` (MQTT), `ArduinoJson`, `Adafruit_INA3221` (ou
  équivalent), `BH1750`, `FastLED`, `Adafruit_SSD1306`, `ESP32Servo`.
- Boucle : mesures I²C à 10 Hz → moyenne → publie `mitsinjo/v1/telemetry` chaque seconde.
- Abonnement `mitsinjo/v1/command` → applique PWM, disjoncteurs, animation LED, jauge SoC, OLED.
- Abonnement `mitsinjo/v1/cloud` → servo (permet au web ou au copilote de déclencher un « nuage » physique).
- Secours USB série : même JSON ligne par ligne si le Wi-Fi tombe (le bridge lit le port série).
- Dossier proposé : `hardware/firmware/` ; schémas et fichiers d'impression 3D : `hardware/kicad/`, `hardware/stl/`.

---

## 7. Plan de réalisation proposé (à transformer en `docs/tasks/PH-hardware-twin.md`)

| Étape | Contenu                                                                                      | Livrable vérifiable                           |
| ----- | -------------------------------------------------------------------------------------------- | --------------------------------------------- |
| H1    | Contrats Zod `TelemetryFrame`, `HardwareCommand`, `HardwareScale` ; `scaleTelemetry` + tests | `make test-engine` vert                       |
| H2    | Extraire `flowFactor` / `feederTone` / contrôleur dans `packages/scene-model` (web inchangé) | 3D identique (`make shots`), tests            |
| H3    | `apps/bridge` + `make bridge-sim` (faux ESP32), mode A (rejeu)                               | le simulateur reçoit des consignes cohérentes |
| H4    | `features/hardware-link` (badge, état, calibration), i18n EN/FR/MG, responsive, thèmes       | `/design-check`, `make check-i18n`            |
| H5    | Montage électrique, firmware, calibration                                                    | maquette qui rejoue `cloudy_afternoon`        |
| H6    | Mode B (lux + demandes) + cache nuage + copilote « mesuré sur la maquette »                  | parcours démo complet en physique             |
| H7    | E2E avec `bridge-sim`, repli automatique sur la simulation si la maquette est absente        | `make e2e` vert sans matériel                 |

---

## 8. Risques et limites

| Risque                                                     | Parade                                                                                                                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wi-Fi de la salle indisponible                             | Point d'accès du portable ; secours USB série                                                                                                                       |
| Maquette en panne le jour de la démo                       | `bridge-sim` + repli automatique : le parcours démo web doit toujours marcher seul                                                                                  |
| Confusion « mesuré » / « simulé » chez le jury             | Label explicite « DONNÉES MAQUETTE — 1 W = 4 kW, 1 h = 20 s », SoC toujours issu du moteur                                                                          |
| Lumière ambiante qui fausse le capteur                     | Calibration sur place ; capteur sous un petit tube orienté vers la lampe                                                                                            |
| Non-linéarité des LED en PWM                               | Courbe de correction dans le bridge (calibration étape 3), pas dans le moteur                                                                                       |
| Pas de temps 1 h trop grossier pour une démo vivante       | Recalcul à chaque trame avec l'heure en cours partiellement mesurée ; plus tard, pas plus fin dans le moteur (changement de contrat lourd, non nécessaire au début) |
| Tentation de calculer des kW dans le firmware ou le bridge | Interdit : conversion d'unités dans `scaleTelemetry` (moteur, testée), le reste applique des consignes                                                              |

La maquette reste une **démonstration pédagogique à l'échelle**, pas un banc de mesure d'ingénierie, comme le
moteur lui-même (`engine-spec.md` : « not an engineering-grade power-flow simulator »).
