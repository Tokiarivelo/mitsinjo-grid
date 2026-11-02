# Kit village autonome — étude (M11-T3)

> **Statut : étude, rien n'est acheté ni assemblé.** Prix indicatifs (nov. 2026, rue/online),
> à revérifier avant tout achat. Puissances = specs constructeur (max), pas des mesures.

## 0. L'idée (O3)

Une boîte qui arrive au village et marche **sans internet** : mini-PC GPU + ESP32 + bridge

- Glimmer local + app locale. La maquette (`docs/maquette-physique.md`) devient un prototype
  de produit : le même moteur, les mêmes règles, mais alimenté par des mesures locales et un
  LLM local.

## 1. Ce qui marche déjà hors-ligne

| Couche               | État offline                                                     | Fichier                                        |
| -------------------- | ---------------------------------------------------------------- | ---------------------------------------------- |
| Moteur               | 100 % local, pur, < 10 ms                                        | `packages/engine`                              |
| Copilote sans cloud  | `LLM_PROVIDER=mock` déterministe, défaut dev/tests               | `server/copilot/providers/mock.ts`             |
| LLM local            | `GlimmerLlmProvider` (Ollama/vLLM), chaîne Meta → Glimmer → mock | `server/copilot/providers/glimmer.ts` (M11-T1) |
| Médias sans R2       | repli data-URL local quand R2 absent                             | `server/storage/media.ts`                      |
| Sessions sans Neon   | map mémoire quand `DATABASE_URL` absent                          | `server/db/neon.ts`                            |
| Perception sans Meta | backend mock déterministe (`fallback` tracé)                     | `server/perception/mock.ts`                    |
| Maquette sans cloud  | bridge local + ESP32, MQTT/série                                 | `docs/bridge.md`                               |

## 2. Ce qui manque encore

1. **Build local de l'app** : l'app est pensée pour Vercel (serverless). En local il faut
   `next build` + `next start` (ou `output: standalone`) sur le mini-PC — jamais testé.
2. **Modèle malgache relu (M11-T2)** : le prompt attend du MG « reviewed » ; le fine-tuning
   Spark Open sur corpus relu par des locuteurs est un travail humain, non commencé.
3. **Premier téléchargement** : poids lourds à prévoir sur place ou avant expédition —
   modèle Glimmer quantifié (~20 Go), `node_modules`, fonts. Prévoir une clé USB d'install.
4. **Tuiles/polices** : vérifier qu'aucune ressource web n'est chargée au runtime
   (fonts locales ? pas de CDN cartes dans l'app — la 3D est procédurale, OK).
5. **Mises à jour** : pas de stratégie (USB ? 4G de passage ?). Hors étude.

## 3. Matériel : deux paliers

Glimmer = 30 B de paramètres, « 1 seul GPU » (table §1 des idées). En Q4 quantifié il faut
≈ 18–20 Go de VRAM — une RTX 3060 12 Go ne suffit pas.

### Palier A — boîte démo (recommandé pour commencer)

| Pièce                   | Choix                                                          | Prix ≈              | Conso max                        |
| ----------------------- | -------------------------------------------------------------- | ------------------- | -------------------------------- |
| Mini-PC GPU             | PC fixe RTX 3090 24 Go reconditionné (ou RTX 4090 si budget)   | 1 200–2 000 €       | 350–450 W (GPU) + 150 W (reste)  |
| Alternative silencieuse | Mac Studio M2 Max 32 Go (mémoire unifiée, ~20 Go dispo modèle) | ~2 200 €            | ~370 W max, ~100 W en charge LLM |
| Serveur LLM             | Ollama (simple) ; vLLM si débit                                | 0 €                 | —                                |
| Bridge + maquette       | ESP32 + MOSFET + capteurs (cf. maquette §5)                    | ~150 €              | < 20 W                           |
| Écran/clavier           | existant                                                       | 0 €                 | —                                |
| **Total**               |                                                                | **≈ 1 400–2 400 €** | **≈ 250–600 W en pointe**        |

### Palier B — boîte village (durcie, solaire)

| Pièce             | Choix                                                                                                      | Prix ≈        | Conso max            |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | ------------- | -------------------- |
| Calcul            | Jetson AGX Orin 64 Go (Glimmer 30B trop gros → petit modèle ou appel mock ; Glimmer 30B reste au palier A) | ~2 000 €      | 60 W                 |
| Stockage/routeur  | SSD 1 To + routeur 4G de secours                                                                           | ~200 €        | 20 W                 |
| Bridge + maquette | idem palier A                                                                                              | ~150 €        | < 20 W               |
| Solaire dédié     | 2 × 400 Wc + batterie LiFePO4 2,5 kWh + MPPT (pour ~100 W continus)                                        | ~1 500 €      | produit ~1,6 kWh/j   |
| **Total**         |                                                                                                            | **≈ 3 850 €** | **≈ 100 W continus** |

## 4. Le point dur : l'énergie du GPU

Un village sous 400 Wc de panneaux ne peut pas offrir 450 W à une RTX 4090 toute la journée.
Règles de l'étude :

- **Le LLM dort par défaut** : inférence à la demande (Ollama décharge le modèle après
  N minutes), resumption ≈ 30 s. Budget visé : < 30 min de GPU/jour en usage conseil.
- **Le mock couvre le continu** : surveillance batterie, autopilote (M10-T1, règles pures),
  enveloppe (M10-T3) tournent sans LLM — le GPU ne sert qu'au dialogue et aux tâches longues.
- **Ordre de grandeur** : 30 min de RTX 3090 (≈ 300 W en inférence) ≈ 150 Wh/j, soit ≈ 10 %
  d'une journée solaire de 400 Wc à Mitsinjo. Acceptable ; une 4090 24 h/24 ne l'est pas.
- **Palier B** : pas de 30 B en continu ; Glimmer y tourne en mode « veille de nuit » (C5,
  non implémenté) ou le kit reste en mock + règles.

## 5. Logiciel du kit (récap)

```
[USB d'install] → mini-PC : Debian + Docker
  ├─ app      : next start (standalone) — LLM_PROVIDER=glimmer, GLIMMER_BASE_URL=http://ollama:11434/v1
  ├─ ollama   : muse-glimmer-30b (Q4), déchargé au repos
  ├─ bridge   : apps/bridge + engine local, MQTT vers l'ESP32
  └─ données  : sessions en mémoire (ou SQLite plus tard), médias en data-URL
[ESP32] ←série/MQTT→ bridge ; aucun egress requis.
```

## 6. Recommandation

1. Monter le **palier A reconditionné** (~1 500 €) pour valider : build standalone,
   Ollama + Glimmer + chaîne de repli, mesures bridge → moteur.
2. Mesurer la conso réelle (prise wattmètre) avant de dimensionner le solaire du palier B.
3. M11-T2 (corpus MG) et la clé USB d'install sont les deux chantiers humains suivants.
