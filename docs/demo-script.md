# 3-Minute Demo Video Script — Mitsinjo Grid

> **Superseded** for the submission video by [`video/VIDEO_PLAN.md`](../video/VIDEO_PLAN.md) (7-day village + Autonomous AI, photo → 3D → village). Kept as a live-demo walkthrough.

> **Target Duration**: Exactly 3 minutes (180 seconds).  
> **Key Hackathon Narrative**: How AI-assisted decision support protects vital life-saving infrastructure in an off-grid solar microgrid during unpredictable weather shocks.  
> **Canonical Demo Path**: `Voice/photo cloud alert` → `Solar drop + strategy comparison` → `Read-aloud explanation with evidence` → `Cut order + approval` → `FR/MG shedding poster` → `Fire report + automatic cut`.

Runs deterministically with `LLM_PROVIDER=mock` (`make dev-mock`): every utterance below, the transcripts and the poster hours are scripted. With Meta models the same words work, transcribed and reasoned live.

---

## Timing Breakdown

```text
┌─────────────────┬─────────────────────────────────────────────────────────────┐
│ 00:00 – 00:25   │ Hook & Context: The Rural Energy Access Problem in Madagascar │
├─────────────────┼─────────────────────────────────────────────────────────────┤
│ 00:25 – 00:55   │ Cloud alert: voice (« Un nuage arrive ») or sky photo       │
│                 │ → solar-drop run → strategy comparison                      │
├─────────────────┼─────────────────────────────────────────────────────────────┤
│ 00:55 – 01:30   │ Copilot explains aloud: readout + computed evidence (SIM id) │
├─────────────────┼─────────────────────────────────────────────────────────────┤
│ 01:30 – 02:05   │ « Coupe le marché ce soir »: impact preview → Approve       │
├─────────────────┼─────────────────────────────────────────────────────────────┤
│ 02:05 – 02:35   │ Shedding poster FR/MG: AI picture, engine hours, PNG export │
├─────────────────┼─────────────────────────────────────────────────────────────┤
│ 02:35 – 03:00   │ « Au feu à l'école ! »: report → automatic cut + alert      │
└─────────────────┴─────────────────────────────────────────────────────────────┘
```

---

## Detailed Step-by-Step Script

### [00:00 – 00:25] Introduction: The Off-Grid Energy Dilemma

- **Visual**: Start on `/overview` (desktop viewport, English). Camera shows the sleek Dark Tech theme, live summary cards, and the glowing 24h battery/solar graph. Point out the clear `SIMULATED DATA` disclosure badge.
- **Narration**:
  > _"Across rural Madagascar and sub-Saharan Africa, thousands of off-grid communities rely entirely on solar microgrids with battery storage. In these villages, electricity isn't just about convenience—it powers the health clinic's vaccine refrigeration cold chain, water pumping, and community livelihoods._  
  > _But when unexpected weather hits and battery reserves run low, how does an operator decide who stays powered and who gets shed? Meet Mitsinjo Grid—an AI-powered copilot and digital twin designed to protect critical lifelines through deterministic math and transparent AI reasoning."_

---

### [00:25 – 00:55] Cloud alert: voice or photo → solar drop → comparison

- **Action** (pick one input, same result):
  - **Voice**: open `/copilot`, click the mic, say _« Un nuage arrive »_. The transcript lands in the composer (mock transcribes the scripted solar-drop question); press **Enter**.
  - **Photo**: attach any cloudy-sky photo to the composer and ask _"The sky is very cloudy — what should we do?"_. The vision model observes the cloud cover and the copilot proposes a matching solar drop for approval.
- **Then type**: _"What happens if solar drops 40 % for 2 hours?"_ then _"Compare the strategies."_
- **Visual**:
  - The 24-hour simulation executes in under 5 ms; the solar curve dips 40 % at noon.
  - Side-by-side **Proportional vs Essential-First**: proportional sheds the clinic below its essential need; Essential-First keeps 100 % critical coverage and sheds households instead.
- **Narration**:
  > _"A cloud is coming. The operator says so — or shows a photo of the sky — and the copilot turns it into a simulated solar drop, then compares strategies. Proportional shedding would cut the clinic's vaccine cold chain; Essential-First protects it. The engine verifies zero energy balance violations."_

---

### [00:55 – 01:30] The copilot explains aloud, with proof

- **Action**:
  1. Ask _"Why does the clinic get less energy?"_
  2. Click **Read response aloud** on the answer (French and Malagasy voices supported; MG stays silent if the browser has no Malagasy voice).
  3. Point at the **Computed evidence** section: the `SIM-…` run id and the engine metrics.
- **Visual**: structured answer streams in (What happened / Computed evidence / Why it matters / Explore next); every number is traceable to the cited simulation run — the AI never invents one.
- **Narration**:
  > _"The copilot doesn't guess. It queries the engine through tools, explains the diagnosis in plain language — read aloud for hands-busy operators — and every number carries its proof: the exact simulation run behind it."_

---

### [01:30 – 02:05] « Coupe le marché ce soir »: impact first, then Approve

- **Action**:
  1. Type _« Coupe le marché ce soir »_ (works in EN/FR/MG, typed or spoken).
  2. Review the proposal card: market cap for tonight with the engine before/after impact per sector.
  3. Click **Approve & Apply Scenario**.
- **Visual**: diff card shows current → proposed per line; nothing applies before approval; the simulation updates live after the click.
- **Narration**:
  > _"'Cut the market tonight.' The copilot previews the impact — who gains, who loses — and only the operator's approval applies it. AI proposes, the human disposes, the engine proves."_

---

### [02:05 – 02:35] Shedding poster FR/MG: AI picture, engine hours

- **Action**:
  1. Type _« Fais une affiche de délestage pour ce soir »_.
  2. Toggle the language to FR, then MG: the poster title and cut hours follow.
  3. Click **Exporter PNG** and show the downloaded poster.
- **Visual**: AI-generated dusk village with a violet _Généré par IA_ badge; the cut hours overlaid in HTML come straight from the engine result (no numbers are ever drawn by the image model).
- **Narration**:
  > _"The village needs to know. The copilot draws a shedding poster — the picture is AI, but the hours are engine truth, overlaid in HTML — in French and Malagasy, exported as PNG for the notice board."_

---

### [02:35 – 03:00] « Au feu à l'école ! »: report → automatic cut + alert

- **Action**:
  1. Click **Report a fire** in the chat header, pick **Primary School**, confirm. (With Meta voice: saying _« Au feu à l'école ! »_ opens this dialog pre-filled.)
  2. Ask _« L'école brûle, qu'est-ce qui se passe ? »_
  3. Point at the incident banner and the 3D view: the school goes dark, its energy reroutes.
  4. Close on the 3D digital twin + _"≈ 1 670 automated tests, 100 % key parity EN/FR/MG."_
- **Narration**:
  > _"Fire at the school! One report cuts power automatically — safety first — and the copilot explains the impact while the alert banner and the 3D twin show the blackout live. Deterministic engine, transparent AI, local languages. Mitsinjo Grid bridges the gap between frontier AI and community resilience."_

---

## Demo Checklist Before Recording

- [ ] Clean browser window at 1440 × 900 resolution.
- [ ] Dev server running (`make dev-mock` for the deterministic run, `make dev` with Meta keys for live AI).
- [ ] Mic permission granted (voice step); a cloudy-sky photo handy (photo alternative).
- [ ] Language set to English default; FR/MG toggle rehearsed for the poster step.
- [ ] Practice 1 dry-run to ensure pacing lands at 2:55 – 3:00.
- [ ] Optional live scale-model segment: three terminals started and "Bridge connected" visible (see below).

---

## Optional: Physical Scale Model (live demo, local only)

Not part of the 3-minute video. Shows the same engine driving a scale model (1 W = 4 kW, 1 h = 20 s by default).
Runs without hardware thanks to the fake ESP32; details in `docs/maquette-physique.md`.

1. Start three terminals:

   ```bash
   BRIDGE_MODE=twin make bridge                                # bridge: MQTT broker + engine + WebSocket :8787
   make bridge-sim                                             # fake ESP32 (c = cloud, q = quit); skip with real hardware
   NEXT_PUBLIC_BRIDGE_URL=ws://localhost:8787 make dev-mock    # web app with the scale-model panel
   ```

   On the deployed site (no `NEXT_PUBLIC_BRIDGE_URL`): open `/simulation?bridge=ws://localhost:8787` (Chrome/Firefox).
   Faster clock for a short demo: press **5 s** under "Speed" in the panel (live, no restart), or prefix the first
   two commands with `HW_TIME_SCALE=4` (1 h = 4 s).

2. Open `/simulation` → **Controls** tab → **Physical scale model** panel → "Bridge connected", "Online — sensors received".
3. Click **Follow the model**: the app loads the bridge scenario, the hour cursor and 3D follow the model clock,
   badge **SCALE MODEL DATA** appears.
4. Around 10:00, click **Cloud over the lamp** (or press `c` in the fake ESP32 terminal): solar output drops in the
   following hours and the deficit grows (compare strategies in Strategy Lab), then ask the Copilot to explain.
5. **Stop following** returns to normal scenario editing.

- **Narration**:
  > _"The same deterministic engine drives a physical scale model. When a cloud covers the model's sun lamp, the
  > measurement flows back into the engine, every number is recomputed, and the copilot explains the trade-off."_
