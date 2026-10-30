# Bridge maquette — configuration et implémentation

Référence du service local `apps/bridge` et de son lien avec le web (`features/hardware-link`).
Pourquoi et comment construire la maquette : `docs/maquette-physique.md`. Formats exacts (Zod) :
`docs/contracts.md` § Physical scale model. Tâches : `docs/tasks/PH-hardware-twin.md`.

## 1. Rôle

```text
 ESP32 (ou faux ESP32) ──MQTT telemetry──► apps/bridge ──WebSocket state──► web /simulation
                       ◄──MQTT command───┘     │      ◄──WebSocket cloud──┘
                                               └─ @mitsinjo/engine (seule source des chiffres)
```

- Tourne **en local** (portable de démo), jamais sur Vercel : il garde une connexion MQTT et un serveur WebSocket.
- Ne calcule aucune valeur d'énergie : il place les mesures sur l'horloge simulée et appelle le moteur
  (`scaleTelemetry`, `simulate`, `toHardwareCommand`).
- Le web ne reprend pas les chiffres du bridge : il reçoit scénario + patch + stratégie + heure et **relance le
  moteur** lui-même.

## 2. Démarrage

```bash
BRIDGE_MODE=twin make bridge                               # 1. bridge (broker MQTT intégré + moteur + WebSocket)
make bridge-sim                                            # 2. faux ESP32 (c = nuage, q = quitter) ; inutile avec la vraie carte
NEXT_PUBLIC_BRIDGE_URL=ws://localhost:8787 make dev-mock   # 3. web, panneau visible dans /simulation → Contrôles
```

Vitesse : par défaut 1 h simulée = 20 s (journée en 8 min). Elle se change **à chaud** dans le panneau (boutons
60 s / 20 s / 10 s / 5 s), sans relancer le bridge ; l'heure en cours est gardée. Pour une autre valeur au démarrage :
préfixer 1 et 2 par `HW_TIME_SCALE=4` (1 h simulée = 4 s). Au démarrage, le bridge affiche sa
configuration effective : `[bridge] twin · cloudy_afternoon · essential_first · 1 W = 4 kW · 1 h = 4 s · ws://localhost:8787`.

### Démo avec la vraie maquette (option A, recommandée)

Le bridge tourne sur le portable de démo, l'ESP32 et le portable sont sur le même Wi-Fi (ou partage de connexion) :

1. Lancer le bridge avec les identifiants MQTT : `MQTT_USERNAME=… MQTT_PASSWORD=… BRIDGE_MODE=twin make bridge`.
2. Régler le firmware de l'ESP32 sur `mqtt://<IP du portable>:1883` avec les mêmes identifiants (IP : `ip addr` /
   `ipconfig`). Sans la vraie carte : `MQTT_USERNAME=… MQTT_PASSWORD=… make bridge-sim`.
3. Ouvrir le site déployé avec `…/simulation?bridge=ws://localhost:8787` (Chrome ou Firefox ; Safari bloque), ou le
   web local `make dev-mock` avec le même lien. Panneau dans « Contrôles ».

Le terminal du bridge doit afficher `MQTT login: on`, et le panneau « En ligne — capteurs reçus ». Détails, limites
et option serveur public : § 8.

## 3. Où mettre les variables (ordre de priorité)

| Programme                      | Ordre (le premier trouvé gagne)                                                           | Lecture                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| Bridge, faux ESP32             | ligne de commande / shell → `.env.local` (racine) → `.env` (racine) → défaut du code      | `apps/bridge/src/env-files.ts` `readEnv` |
| Web (`NEXT_PUBLIC_BRIDGE_URL`) | shell → `apps/web/.env.local` → `apps/web/.env` → `.env.local` (racine) → `.env` (racine) | `apps/web/scripts/port.mjs` puis Next    |

- **`.env.example` n'est jamais lu** : c'est le modèle à copier (`cp .env.example .env`). Y changer une valeur
  n'a aucun effet.
- Une variable vide (`MQTT_URL=`) compte comme absente : la valeur par défaut s'applique.
- `NEXT_PUBLIC_BRIDGE_URL` est figée dans le code du navigateur au démarrage de `make dev` : la changer demande de
  **relancer** le serveur web.
- Valeur invalide (mode inconnu, port hors 1–65535, URL mal formée) → le bridge refuse de démarrer avec une erreur Zod
  qui nomme la variable.

## 4. Variables

| Variable                         | Lue par            | Défaut                        | Valeurs permises                                                                                         | Effet                                                                                                                                                                                             |
| -------------------------------- | ------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BRIDGE_MODE`                    | bridge             | `replay`                      | `replay`, `twin`                                                                                         | `replay` : le moteur pilote la maquette, les capteurs sont ignorés. `twin` : lumière et demandes mesurées modifient l'entrée du moteur (§ 5.3).                                                   |
| `BRIDGE_SCENARIO`                | bridge             | `cloudy_afternoon`            | `baseline`, `cloudy_afternoon`, `high_demand`, `battery_constraint`, `essential_stress`, `meter_anomaly` | Scénario de base rejoué ou corrigé par les mesures. Le web le charge quand on clique « Suivre la maquette ».                                                                                      |
| `BRIDGE_STRATEGY`                | bridge             | `essential_first`             | `proportional`, `essential_first`, `balanced`                                                            | Stratégie dont les consignes partent vers la maquette ; devient la stratégie active du web en suivi.                                                                                              |
| `BRIDGE_WS_PORT`                 | bridge             | `8787`                        | 1–65535                                                                                                  | Port du WebSocket écouté par le web. Doit correspondre à `NEXT_PUBLIC_BRIDGE_URL`.                                                                                                                |
| `BRIDGE_EMBEDDED_BROKER`         | bridge             | `true`                        | `true`, `false`                                                                                          | `true` : le bridge lance son propre broker MQTT (aedes) sur `MQTT_PORT`, rien à installer. `false` : utiliser un broker externe (`MQTT_URL`).                                                     |
| `MQTT_PORT`                      | bridge, faux ESP32 | `1883`                        | 1–65535                                                                                                  | Port du broker intégré, et port par défaut des clients.                                                                                                                                           |
| `MQTT_URL`                       | bridge, faux ESP32 | `mqtt://localhost:$MQTT_PORT` | URL `mqtt://hôte:port` ou `mqtts://hôte:8883`                                                            | Broker auquel se connectent bridge et faux ESP32. À régler si le broker est ailleurs (ex. Raspberry Pi `mqtt://192.168.4.1:1883`, broker hébergé en `mqtts://`).                                  |
| `MQTT_USERNAME`, `MQTT_PASSWORD` | bridge, faux ESP32 | vides                         | les deux ou aucun                                                                                        | Identifiants MQTT. Broker intégré : refuse toute connexion sans eux (« Not authorized »). Broker externe : envoyés à la connexion. Le firmware utilise les mêmes.                                 |
| `BRIDGE_TOKEN`                   | bridge             | vide                          | ≥ 16 caractères                                                                                          | Vide : tout navigateur peut piloter (usage local). Rempli : seul un navigateur ouvert avec `?bridgeToken=<jeton>` peut envoyer nuage et vitesse ; les autres voient la maquette en lecture seule. |
| `HW_POWER_SCALE`                 | bridge, faux ESP32 | `4000`                        | 1–100 000                                                                                                | 1 W maquette = `HW_POWER_SCALE` W simulés (4000 → 1 W = 4 kW). Sert au rapport cyclique : `duty = servedKw / (nominalW × échelle / 1000)`.                                                        |
| `HW_TIME_SCALE`                  | bridge, faux ESP32 | `20`                          | 1–3600                                                                                                   | Vitesse au démarrage, en secondes réelles par heure simulée. 20 → journée en 8 min ; 4 → 96 s. Modifiable ensuite dans le panneau.                                                                |
| `HW_LUX_FULL_SUN`                | bridge, faux ESP32 | `20000`                       | > 0, ≤ 200 000                                                                                           | Lux du capteur sous la lampe sans nuage = heure de ciel clair. À **calibrer sur place** (§ 6 de l'étude). Le faux ESP32 envoie exactement cette valeur (× 0,3 avec nuage).                        |
| `NEXT_PUBLIC_BRIDGE_URL`         | web (navigateur)   | vide                          | URL `ws://…` ou vide                                                                                     | Bridge par défaut. Vide → panneau masqué, sauf ouverture par un lien `?bridge=` (§ 8). Rempli → le web se connecte toujours à ce bridge.                                                          |

Les puissances nominales par départ (`nominalW` : santé 0,3 W, eau 0,75 W, école 0,375 W, ménages 1,5 W, marché 0,5 W,
usine 2 W) n'ont pas de variable : elles viennent de `DEFAULT_HARDWARE_SCALE` dans le moteur (calibration : tâche H4-T2).

## 5. Implémentation

### 5.1 Fichiers

| Fichier                                   | Contenu                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `packages/engine/src/schemas/hardware.ts` | Zod : `HardwareScale`, `TelemetryFrame`, `TelemetrySample`, `HardwareCommand`, `BridgeState`, `BridgeMessage`      |
| `packages/engine/src/hardware/index.ts`   | `DEFAULT_HARDWARE_SCALE`, `scaleTelemetry` (mesures → `InputPatch`), `toHardwareCommand` (résultat → consignes)    |
| `packages/engine/src/dispatch/index.ts`   | `breakerFromMode`, `controllerModeAt`, `feederTone`, `flowLevel` — partagés avec la 3D et les schémas 2D           |
| `apps/bridge/src/config.ts`               | Lecture et validation des variables (§ 4), topics MQTT                                                             |
| `apps/bridge/src/env-files.ts`            | Fusion shell > `.env.local` > `.env` (§ 3)                                                                         |
| `apps/bridge/src/session.ts`              | `BridgeSession` sans réseau : horloge simulée, collecte des mesures, appel du moteur (testé)                       |
| `apps/bridge/src/access.ts`               | `canControl` (jeton WebSocket), `mqttLoginOk` (identifiants du broker intégré), comparaison à temps constant       |
| `apps/bridge/src/main.ts`                 | Broker aedes, client MQTT, serveur WebSocket, boucle de 1 s                                                        |
| `apps/bridge/src/sim-device.ts`           | Faux ESP32 : télémétrie 1 Hz, touche nuage, affichage des consignes                                                |
| `apps/web/src/features/hardware-link/`    | `useBridgeTarget` (lien `?bridge=`), `useHardwareLink` (WebSocket + reconnexion), `HardwareLinkPanel`, utilitaires |
| `apps/web/src/stores/simulation.store.ts` | `source: 'scenario' \| 'device'`, `applyDeviceRun`, `releaseDevice`                                                |

### 5.2 Boucle du bridge (toutes les secondes)

1. `simClock` → jour et heure simulés (`heures = départ + t / (vitesse × 1000)`). Un changement de vitesse
   (`setTimeScale`) note où en est l'horloge et repart de là : pas de saut d'heure.
   Nouveau jour → les mesures de la veille sont effacées (on repart du scénario).
2. Mode `twin` : `scaleTelemetry(mesures, échelle, scénario)` → patch ; mode `replay` : patch vide.
3. `simulate(scénario + patch, BRIDGE_STRATEGY)` puis `toHardwareCommand(…, heure)`.
4. Publie la commande sur MQTT `mitsinjo/v1/command` et l'état `{type:'state', state}` à tous les navigateurs.
5. Écrit une ligne dans le terminal à chaque changement d'heure.

### 5.3 Ce que font les mesures (mode `twin`)

Pour chaque heure simulée déjà mesurée (moyenne de toutes les trames reçues pendant cette heure, heure en cours comprise) :

- `solarProfile[h] = profil_du_scénario[h] × clamp(lux_moyen / HW_LUX_FULL_SUN, 0, 1)` — la lampe pleine = ciel clair,
  jamais plus que le scénario ; la nuit reste à 0.
- `meterReadings[secteur][h] = demande_attendue[h] × demande_moyenne` (interrupteur 0–1) ; la demande attendue est
  celle du moteur (`computeProfileDemandKw`).
- Heures pas encore mesurées : profil et demande du scénario (prévision).

Le courant mesuré après chaque MOSFET n'entre **jamais** dans le calcul (il dépend de la décision du moteur) : il sert à
vérifier le matériel. La batterie physique non plus : l'état de charge affiché est celui du moteur.

### 5.4 Messages

| Canal                                 | Sens           | Contenu                                                                                                                     |
| ------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| MQTT `mitsinjo/v1/telemetry`          | ESP32 → bridge | `TelemetryFrame` JSON ~1 Hz (lux, tensions/courants INA3221, demandes 0–1). Trame invalide → ignorée avec un avertissement. |
| MQTT `mitsinjo/v1/command`            | bridge → ESP32 | `HardwareCommand` : heure, mode du contrôleur, SoC, par départ `duty` 0–1, `breaker`, `flow` 0–1, `tone`.                   |
| MQTT `mitsinjo/v1/cloud`              | bridge → ESP32 | `{ "on": true \| false }` : servo du nuage.                                                                                 |
| WebSocket `{type:'access', control}`  | bridge → web   | À la connexion : `control` false = lecture seule (jeton absent ou faux), les commandes de ce client sont ignorées.          |
| WebSocket `{type:'state'}`            | bridge → web   | `BridgeState` : mode, scénario, stratégie, jour, heure, patch, maquette en ligne, échelle, commande.                        |
| WebSocket `{type:'cloud', on}`        | web → bridge   | Relayé tel quel sur `mitsinjo/v1/cloud`.                                                                                    |
| WebSocket `{type:'speed', timeScale}` | web → bridge   | Nouvelle vitesse (1–3600 s par heure) ; hors limites → ignorée. L'état suivant renvoie la vitesse effective.                |

« Maquette en ligne » = une trame valide reçue depuis moins de 5 s (`DEVICE_TIMEOUT_MS`).

### 5.5 Côté web

- `HardwareLinkSection` ne s'affiche que si un bridge est connu : lien `?bridge=` (gardé pour l'onglet), sinon
  `NEXT_PUBLIC_BRIDGE_URL` (§ 8).
- Lecture seule (`control` false) : boutons nuage et vitesse grisés, note « Lecture seule » ; « Suivre » reste possible.
- `useHardwareLink` : connexion WebSocket, reconnexion toutes les 3 s (`RECONNECT_MS`), chaque message validé par
  `BridgeMessageSchema` (message invalide ignoré).
- « Suivre la maquette » → `applyDeviceRun` : recharge le scénario du bridge, applique le patch, prend sa stratégie,
  journée unique, curseur sur l'heure de la maquette, relance le moteur. Ensuite, seul un changement de scénario,
  stratégie, heure ou patch (`deviceRunKey`) relance le calcul.
- « Vitesse » : boutons 60 / 20 / 10 / 5 s (`TIME_SCALE_PRESETS`) ; le bouton actif suit `state.scale.timeScale`
  (confirmé par le bridge, pas par le clic).
- Le suivi s'arrête avec « Arrêter le suivi » ou dès qu'on charge un scénario (`source` repasse à `scenario`).

## 6. Tests

`make test-bridge` (session, horloge, configuration, priorité des fichiers env) · `make test-engine`
(`__tests__/hardware.test.ts`) · `pnpm --filter web test -- hardware-link` (panneau, hook, store, avec une fausse
WebSocket). Scénarios manuels : T20–T24, S62–S73, D10–D14 (`test-scenarios/`, local).

## 7. Dépannage

| Symptôme                             | Cause probable → solution                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pas de panneau « Maquette physique » | `NEXT_PUBLIC_BRIDGE_URL` absent ou mis dans `.env.example` → le mettre dans `.env` (relancer `make dev`) ou ouvrir `?bridge=ws://localhost:8787`. |
| « Lecture seule » dans le panneau    | Le bridge a un `BRIDGE_TOKEN` → rouvrir le lien avec `&bridgeToken=<jeton>`.                                                                      |
| ESP32 : « Not authorized »           | `MQTT_USERNAME` / `MQTT_PASSWORD` différents entre bridge et carte.                                                                               |
| Badge « Bridge hors ligne »          | Bridge non lancé, ou port différent de l'URL → vérifier la ligne `ws://localhost:…` affichée au démarrage.                                        |
| « Aucune mesure (rejeu seul) »       | Pas de trame depuis 5 s : lancer `make bridge-sim` ou vérifier la carte (même `MQTT_URL`).                                                        |
| Mode ou échelle inattendus           | Comparer avec la ligne de démarrage du bridge ; la ligne de commande gagne sur `.env`, `.env.example` ne compte pas.                              |
| `EADDRINUSE` au démarrage            | Un autre bridge ou Mosquitto occupe le port → l'arrêter, ou changer `MQTT_PORT` / `BRIDGE_WS_PORT`.                                               |
| Le nuage ne change rien              | Mode `replay` (capteurs ignorés) → `BRIDGE_MODE=twin` ; ou heure de nuit (solaire déjà à 0).                                                      |

## 8. Version déployée (Vercel)

Le bridge **ne peut pas tourner sur Vercel** : il garde une connexion MQTT et un serveur WebSocket ouverts en
permanence, ce que des fonctions serverless ne font pas. Il tourne toujours à côté (portable ou serveur).
Le site déployé reste sans `NEXT_PUBLIC_BRIDGE_URL` : les visiteurs ne voient pas le panneau. Pour la démo, on
l'ouvre avec un **lien** :

```
https://<site>/fr/simulation?bridge=ws://localhost:8787                          # bridge sur ce portable
https://<site>/fr/simulation?bridge=wss://bridge.exemple.org&bridgeToken=<jeton>  # bridge public
https://<site>/fr/simulation?bridge=off                                          # oublier le bridge
```

Le lien est gardé pour l'onglet (`sessionStorage`), puis retiré de la barre d'adresse (le jeton n'y reste pas).
Seules les URL `ws://` / `wss://` sont acceptées. Le jeton voyage dans l'URL du WebSocket (`?token=`) : utiliser
`wss://` pour qu'il soit chiffré.

### Option A — bridge sur le portable de démo (recommandée)

1. Portable et ESP32 sur le même Wi-Fi (ou partage de connexion du téléphone).
2. `MQTT_USERNAME=… MQTT_PASSWORD=… BRIDGE_MODE=twin make bridge` ; firmware réglé sur
   `mqtt://<IP du portable>:1883` avec les mêmes identifiants (sinon n'importe qui sur le Wi-Fi peut publier).
3. Ouvrir le site déployé avec `?bridge=ws://localhost:8787`. Chrome et Firefox autorisent un site HTTPS à joindre
   `ws://localhost` (Chrome peut demander l'accès au réseau local) ; **Safari le bloque**. Sans Internet : `make dev`
   en local, même lien.

### Option B — bridge sur un serveur public

1. Machine avec un process Node permanent (VPS, Fly.io, Railway) : `pnpm install` puis `pnpm --filter bridge start`.
2. Broker MQTT hébergé (HiveMQ Cloud, EMQX Cloud) : `BRIDGE_EMBEDDED_BROKER=false`,
   `MQTT_URL=mqtts://<hôte>:8883`, `MQTT_USERNAME`, `MQTT_PASSWORD` ; l'ESP32 s'y connecte en TLS.
3. `BRIDGE_TOKEN` = longue valeur aléatoire (`openssl rand -hex 24`). Sans jeton, le bridge est ouvert à tous.
4. TLS devant le WebSocket : le bridge parle en `ws://` ; un proxy (Caddy :
   `bridge.exemple.org { reverse_proxy localhost:8787 }`) ou l'hébergeur fournit `wss://`.
5. Lien de démo : `?bridge=wss://bridge.exemple.org&bridgeToken=<jeton>`. Sans jeton : lecture seule.
