# PH — Maquette physique à l'échelle (jumeau matériel)

**Read first:** `docs/maquette-physique.md` (étude complète) · `docs/contracts.md` · `docs/engine-spec.md` §1, §5
**Skills:** `/engine-change` (H1) · `/scene-3d` (H2) · `/ui-feature` + `/design-check` (H4) · `/copilot-tool` (H6)

**Objectif.** Relier une maquette basse tension (ESP32, panneau 10 W, 6 départs MOSFET, LED) au projet :
d'abord en **rejeu** (le moteur décide, la maquette applique), puis en **jumeau** (la maquette mesure
l'ensoleillement et la demande, le moteur recalcule). Échelle par défaut : 1 W maquette = 4 kW simulés,
1 h simulée = 20 s par défaut (réglable à chaud : 60 / 20 / 10 / 5 s).

Règle intouchable : **les chiffres viennent de `@mitsinjo/engine`**. Le bridge et le firmware ne font que
convertir des unités (via le moteur) et appliquer des consignes. Le SoC affiché est celui du moteur.

## Phase 1 — Moteur : entrées mesurées et conversion (`/engine-change`)

- [x] **H1-T1** `InputPatch.solarProfile?: number[24]` (0–1) remplace `solar.profile` dans `applyPatch`.
      **Done when** schéma Zod + test patch + `docs/contracts.md`.
- [x] **H1-T2** Contrats `HardwareScale`, `TelemetryFrame`, `TelemetrySample`, `HardwareCommand`
      (Zod, `schemas/hardware.ts`) + `DEFAULT_HARDWARE_SCALE` (`powerScale 4000`, `timeScale 20`).
      **Done when** schémas exportés, bornes testées, `docs/contracts.md` à jour.
- [x] **H1-T3** `scaleTelemetry(samples, scale, base) → InputPatch` pure : lux moyen par heure →
      `solarProfile[h] = profil_base[h] × clamp(lux / luxFullSun)` ; demande attendue (`computeProfileDemandKw`)
      × demande moyenne 0–1 → `meterReadings` ; heures non mesurées inchangées.
      **Done when** tests : sans mesure = patch vide, tout allumé + plein soleil = mêmes résultats que la base,
      nuage seulement sur les heures mesurées, secteur coupé = 0 kW, entrée non modifiée.
- [x] **H1-T4** `toHardwareCommand(input, result, hour, scale, seq?) → HardwareCommand` :
      `duty = served / nominalKw` borné 0–1, `breaker` depuis le mode, `flow`, `socPct` du moteur.
      **Done when** tests sur `cloudy_afternoon` (24 h valides, secteur déconnecté ouvert).

## Phase 2 — Mapping visuel partagé (`/scene-3d`)

- [x] **H2-T1** `breakerFromMode`, `feederModeAt`, `controllerModeAt`, `flowLevel` (+ `FLOW_SATURATION_KW`)
      déplacés dans `packages/engine/src/dispatch/` ; `to-scene-model.ts` et `scene-palette.ts` (`flowFactor`)
      les réutilisent. **Done when** typecheck web + tests 3D verts.
- [x] **H2-T2** Règle de couleur d'un départ dans le moteur (`feederTone` → `ok|warning|critical|idle`), la 3D la
      convertit en tokens, `HardwareCommand.feeders[s].tone` la porte aux LED. `make shots` : pages OK
      (navigateur sans WebGL → schéma 2D, pas de simulation lancée : couleurs vérifiées par les tests).

## Phase 3 — Service local `apps/bridge`

- [x] **H3-T1** Paquet `apps/bridge` (Node 22, `mqtt`, `ws`, `aedes` broker embarqué, `@mitsinjo/engine`) :
      `BridgeSession` (sans I/O, testée) place les trames sur l'horloge simulée, appelle `simulate`, publie
      `HardwareCommand` ; WebSocket `BridgeState` chaque seconde.
- [x] **H3-T2** Mode rejeu (`BRIDGE_MODE=replay`, défaut) et mode jumeau (`twin`) ; nouvelle journée = mesures remises à zéro.
- [x] **H3-T3** `make bridge-sim` : faux ESP32 (touche `c` = nuage, consignes affichées par heure).
- [x] **H3-T4** Makefile (`bridge`, `bridge-sim`, `test-bridge`), `.env.example`, README.
      Broker embarqué : pas de cible `mqtt` (Mosquitto) nécessaire.

## Phase 4 — Web : lien maquette (`/ui-feature`, `/design-check`)

- [x] **H4-T1** Store `source: 'scenario' | 'device'` + `applyDeviceRun` / `releaseDevice` ; `BridgeStateSchema` dans le
      moteur (partagé bridge/web) ; `features/hardware-link` : `useHardwareLink()` (WebSocket, reconnexion 3 s,
      messages validés), `HardwareLinkPanel` dans l'onglet Contrôles de `/simulation` (statut, mode, échelle, horloge,
      badge « DONNÉES MAQUETTE », Suivre / Arrêter, Nuage). Visible seulement si `NEXT_PUBLIC_BRIDGE_URL` est défini.
- [ ] **H4-T2** Panneau calibration (lux plein soleil, puissances nominales) — après le premier montage (H5).

## Phase 5 — Matériel et firmware

- [ ] **H5-T1** Montage selon `docs/maquette-physique.md` §5 ; schéma dans `hardware/kicad/`.
- [ ] **H5-T2** Firmware `hardware/firmware/` (PlatformIO) : télémétrie 1 Hz, commandes, chien de garde 5 s.
- [ ] **H5-T3** Calibration + rejeu de `cloudy_afternoon` sur la maquette.

## Phase 6 — Mode jumeau et copilote

- [ ] **H6-T1** Mode jumeau (lux + interrupteurs de demande) + servo « nuage ».
- [ ] **H6-T2** Copilote : `get_grid_state` indique `source: 'device'` (« mesuré sur la maquette »).

## Phase 7 — Tests de bout en bout

- [ ] **H7-T1** E2E avec `bridge-sim` ; repli automatique sur la simulation si la maquette est absente.

## Phase 8 — Version déployée (voir `docs/bridge.md` § 8)

- [x] **H8-T0** Vitesse réglable à chaud : `TIME_SCALE_PRESETS` (60/20/10/5 s), message WebSocket `speed`,
      `BridgeSession.setTimeScale` sans saut d'heure, boutons « Vitesse » dans le panneau ; défaut 20 s.
- [x] **H8-T1** URL du bridge choisie à l'exécution (ex. `?bridge=ws://localhost:8787` gardé en session) au lieu de
      `NEXT_PUBLIC_BRIDGE_URL` seul : panneau caché pour les visiteurs, visible pour la démo sur le site déployé.
- [x] **H8-T2** Bridge public : jeton `BRIDGE_TOKEN` (`?bridgeToken=`) vérifié à la connexion WebSocket (commandes `cloud`/`speed`
      refusées sans jeton → lecture seule), identifiants MQTT (`MQTT_USERNAME`/`MQTT_PASSWORD`, broker intégré et
      clients), TLS via proxy ou broker hébergé (`wss://`, `mqtts://`), guide `docs/bridge.md` § 8.

## Exit criteria

Parcours démo complet sur la maquette (nuage → comparaison → explication IA → preuve), `make check` et
`make e2e` verts sans matériel, `violations = 0`.
