# Mitsinjo Grid — 3-minute demo video: production plan

Single source of truth for the hackathon video (task file: `docs/tasks/PD-demo-video.md`, closes **P9-T5**).
Everything an agent needs is here: rules, format, style, storyboard, voice-over, on-screen text, capture
scenarios, assets, folder layout and the render pipeline. Supersedes the narrative of `docs/demo-script.md`.

---

## 0. Hackathon rules that bind the video (organizer answers, 2026-11-03)

| Rule                                                                             | How this plan meets it                                                                                                           |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **≤ 3:00**, understandable in English                                            | 2:58 target, English voice + English captions                                                                                    |
| **Opens with one line**: what existed before the event, what was built this week | Segment 00 voice + splash text (§ 5): the event started Oct 26, 2026 = first commit (confirmed by the author); no pre-event code |
| Show the **working product**, not slides; **most of it real screen footage**     | ≥ 90 % live capture; canvas only for the 5 s splash and the 6 s outro; titles are overlays on footage                            |
| **Live Meta model calls visible**                                                | `LLM_PROVIDER=meta`; model picker on screen; server-log inset with `[copilot:meta]` / `[vision]` lines (§ 6, L1–L3)              |
| A video **made and presented by a person** is preferred (AI voice allowed)       | The author's own voice (default); optional 3 s webcam bubble in 00 and 10                                                        |
| Rights to **every** asset; music source **credited in the README**               | Music credit in `README.md` + outro; SFX generated with ffmpeg; fonts from the app; reference clip never used                    |
| Deadline **Wed Nov 4, 9:00 PM ET**, no edits after                               | Render + upload + README link before 6:00 PM ET (3 h buffer)                                                                     |

Repo-side rules (not video, tracked in the task file): event-only code in the public repo (README provenance
line), judges run it from the README setup, own Meta key via `.env.example` or keyless mock mode with
provenance (traces, outputs, this video), never commit a key. Most Viral prize: one X post linked in the
submission, counted through Nov 8 EOD.

---

## 1. Deliverable

| Item         | Value                                                                                                                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Length       | **≤ 3:00** (target 2:58), 11 segments, timecodes in § 4                                                                                                                                                                       |
| Format       | **1280 × 720, 30 fps**, H.264 High `yuv420p`, AAC 192 kb/s 48 kHz stereo, `.mp4` faststart                                                                                                                                    |
| Language     | **English** voice-over + English burned-in captions (`subtitles/en.srt`, also muxed soft)                                                                                                                                     |
| Music        | "Passion" — Luke Bergs & AgusAlvarez, publisher Free To Use Music (2025), 2:43. Free to use, no license or rights required (author, 2026-11-03); committed at `video/audio/music/adventure-theme.mp3`, credited in the README |
| Output       | `video/output/mitsinjo-grid-demo-720p.mp4` (+ `-backup.mp4` = second full take, P9-T5)                                                                                                                                        |
| Two features | **A.** a 7-day village scenario, every setting, then **Autonomous AI** dispatch                                                                                                                                               |
|              | **B.** photo → 2D facade → **3D generation (advanced)** → import into the village                                                                                                                                             |

Project non-negotiables (`CLAUDE.md`): the `SIMULATED DATA` label stays visible in every app shot; every
number shown (captures **and** overlays) is engine output read from the app or `benchmarks/`, never typed by
hand; AI text stays visually distinct from computed metrics; only Meta models in the AI shots.

---

## 2. Style (from the reference clip)

Reference: a vertical product-motion clip, kept local in `video/reference/` (third-party, never committed,
never cut into our video). What we keep, adapted to 16:9 and to "real footage first":

- **Macro close-ups of settings panels.** Zoom the live capture to ~180 % on the control being changed
  (dropdown, slider, toggle) with an **oversized cursor** (≈ 48 px, white, dark outline, soft shadow)
  moving in eased arcs. This is the signature look; it is all real footage.
- **Short shots.** 0.8–2.5 s per close-up, cut on the click; nothing holds still longer than 4 s.
- **Curved card carousel** (3D cylinder of app screenshots) only as a 2 s accent inside the splash and the
  outro — never as a scene on its own.
- **Motion:** ease-out cubic (`cubic-bezier(.22,1,.36,1)`), 250–400 ms, slight overshoot on overlays,
  slide-up 24 px + fade for text. One whoosh per scene change, one soft click per cursor click.
- **Palette (dark tokens of `apps/web/src/app/globals.css` — keep in sync):** canvas `#080d1a` · surface
  `#111d30` · text `#f4f7fb` · solar amber `#ffb547` · battery green `#53d6a0` · AI violet `#b6a0ff` ·
  critical red `#ff7185`. AI text = violet; engine numbers = white / green / amber. Dark theme only.
- **Type:** the app font (read it from `apps/web/src/app/layout.tsx`); titles 56 px / 600, kickers 20 px
  upper-case tracked +8 %, captions 30 px / 400 on a 70 % canvas box.

---

## 3. Folder layout (`video/`)

```text
video/
├── VIDEO_PLAN.md            this file
├── .gitignore               raw captures, frames, renders, reference stay local
├── audio/
│   ├── music/adventure-theme.mp3      background track (committed, § 1)
│   ├── voice/vo-00-provenance.wav … vo-10-outro.wav   one take per segment (48 kHz mono)
│   ├── voice/vo-full.wav              assembled + cleaned voice track
│   └── sfx/click.wav, whoosh.wav, rise.wav      generated with ffmpeg (§ 8)
├── brand/logo.png, icon-512.png       copied from apps/web/public
├── icons/*.svg              line icons for overlays: sun, cloud, storm, battery, clinic, school, pump,
│                            house, ai-spark, cube, camera, plug, shield, hand (2 px stroke, 48 × 48)
├── images/                  app stills for the splash / outro carousel (dark, 1280 × 720)
├── canvas/                  HTML animation sources, rendered frame by frame
│   ├── shared.css, timeline.js        tokens, font, seekable timeline helper
│   ├── 00-splash.html, 10-outro.html  full-frame scenes (the only ones)
│   └── overlays/chapter.html, lower-third.html, recap-card.html   transparent PNG sequences
├── scripts/
│   ├── capture.spec.ts      Playwright, headed + GPU, drives every app shot (§ 6)
│   ├── record-region.sh     ffmpeg x11grab of the browser viewport (+ log terminal for L-shots)
│   ├── render-canvas.mjs    seeks each canvas page frame by frame → PNG sequence
│   └── build.sh             cuts, speed ramps, zooms, overlays, mix, captions, final encode
├── subtitles/en.srt         captions = voice-over text (§ 5)
├── captures/raw/            ignored: run recordings + markers.json + server logs
├── captures/clips/          ignored: trimmed / sped-up clips
├── frames/                  ignored: canvas PNG sequences
├── output/                  ignored: final renders + values.md (numbers used in overlays)
└── reference/               ignored: the style reference clip
```

---

## 4. Storyboard (≈ 178 s)

`APP` = live capture · `CV` = canvas · `OV` = overlay on live capture · `×N` = speed ramp in post.
Canvas share: 11 s / 178 s ≈ 6 %. Shot ids map to § 6.

| #   | Time      | Type     | Shot                                                                                                                                                                                                                                         | On-screen text (exact)                                                                                                                                                            |
| --- | --------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00  | 0:00–0:07 | CV       | **Splash + provenance line.** Logo scales 0.8 → 1 with glow, sun arc rises behind the village line icon, title types in; at 0:03 the provenance line slides up. Optional webcam bubble bottom-right. Music fades in over 1 s.                | `MITSINJO GRID` · `AI copilot for a rural solar microgrid` · `Built from scratch during the hackathon · first commit Oct 26, 2026` · `SIMULATED DATA`                             |
| 01  | 0:07–0:17 | APP      | **Hook (H1).** `/overview` live cards, then `/simulation` 3D village slow orbit at golden hour: clinic, school, pump, houses.                                                                                                                | OV kicker `ONE MICROGRID · ONE VILLAGE` → `Who keeps the light?`                                                                                                                  |
| 02  | 0:17–0:40 | APP + OV | **Build the week (A1–A4).** Chapter overlay 1.5 s, then macro close-ups: 7 days of weather, Chaos mode, strategy, parameters, priorities & caps.                                                                                             | OV `01 · A WEEK IN THE VILLAGE` · lower-thirds `Weather workflow · 7/7 days` · `Chaos mode` · `Every setting is a lever`                                                          |
| 03  | 0:40–1:00 | APP      | **Play the week ×8 + compare (A5–A6).** Playback, 3D day/night, storm day turns critical, battery dips; Strategy Lab side by side.                                                                                                           | `7 simulated days in 20 seconds` · `Same week · two strategies`                                                                                                                   |
| 04  | 1:00–1:13 | APP      | **Copilot explains, live (A7 + L1).** Model picker shows `muse-spark-1.3`; question; answer streams (violet); zoom on **Computed evidence** + `SIM-…`; 2 s inset of the server log `[copilot:meta] …`.                                       | `Live call · Meta Muse Spark` · `Every number = engine evidence`                                                                                                                  |
| 05  | 1:13–1:35 | APP      | **Autonomous AI (A8–A10).** **Autonomous AI** mode, `AI IN CONTROL`, Event Log ×6, Before / After + Engine evidence, **Report a fire** → sector isolated, **Take back control**, **Shift report**.                                           | `Autonomous AI · within village rules` · `Every action logged & undoable`                                                                                                         |
| 06  | 1:35–1:52 | APP + OV | **Detect, live (B1–B2 + L2).** Chapter overlay 1.5 s; drop photo, outlines, `{count} detected`; Magnetic lasso; 2 s inset of the `[vision] …` log.                                                                                           | OV `02 · FROM A PHOTO TO THE VILLAGE` · `Live call · SAM 3.1 + Muse Spark` · `AI perception · to verify`                                                                          |
| 07  | 1:52–2:15 | APP      | **Imagine & build 3D, advanced (B3–B6 + L3).** 2D facade with details → retry → validate; AI steps with live seconds; stages Massing → Roof → Openings → Accessories with stage score; 6 imagined views; turn, size, tint. Waits ×10 or cut. | `Live call · Muse Image` · `Muse Spark · 3D, piece by piece` · `Stage score {before} → {after}` (live value)                                                                      |
| 08  | 2:15–2:38 | APP      | **Insert into the village (B7–B9).** AI estimate ↔ Manual, watts, quantity, 24 h curve; Place on the map, Feeder line; **Insert into simulation**; 3D village: object on its plinth, lit by day, dimmed at night.                            | `Its load joins the engine` · `Placed in the 3D twin`                                                                                                                             |
| 09  | 2:38–2:52 | APP + OV | **Recap over live footage (R1).** Slow 3D orbit of the village with the inserted model; 4 recap cards slide in one by one (values from `output/values.md`).                                                                                  | `Deterministic engine` · `Meta: Muse Spark · Muse Image · SAM 3.1` · `AI acts within rules` · `Photo → 3D → load`                                                                 |
| 10  | 2:52–2:58 | CV       | **Outro.** Logo, repo URL, model + music credits, badge; optional webcam bubble; music fades out over the last 4 s.                                                                                                                          | `MITSINJO GRID` · `github.com/Tokiarivelo/mitsinjo-grid` · `Built with Meta Muse Spark · Muse Image · SAM 3.1` · `Music: "Passion" — Luke Bergs & AgusAlvarez` · `SIMULATED DATA` |

Demo-path check (`CLAUDE.md`): solar drop (03) → strategy comparison (03) → AI explanation (04) → computed
evidence (04). Keep all four on screen even if a segment is shortened. If over time, cut in this order:
A4 parameters (keep 2 of 4) → B5 views → B2 lasso → H1 overview part.

---

## 5. Voice-over script (English, ≈ 150 wpm, ≈ 380 words)

Recording: the author's own voice (organizers prefer a person presenting). Fallback only if impossible: Meta
**MMS-TTS** (`facebook/mms-tts-eng`, local; robotic; PyTorch ≈ 1.5 GB — check disk). One WAV per segment,
0.3 s silence head/tail. Replace every `{…}` with the value the app showed in the capture — never invent one.
Segment 00 must be the very first words of the video.

| #   | Words | Voice-over                                                                                                                                                                                                                                                                                                                 |
| --- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00  | 18    | Before this hackathon, none of this existed: no code, only open-source libraries. Everything you'll see, I built this week.                                                                                                                                                                                                |
| 01  | 33    | In rural Madagascar, one small solar microgrid powers a clinic, a school, the water pump and every home. When the sun drops, someone has to decide who keeps the light. Mitsinjo Grid is an AI copilot for that decision.                                                                                                  |
| 02  | 50    | This village is fully simulated. I build a seven-day week: sunny, cloudy, then a storm. Chaos mode adds random incidents. Every setting is a lever: the allocation strategy, the clinic's lifeline floor, the night battery reserve, sector priorities and caps.                                                           |
| 03  | 46    | We play the whole week in seconds. On the storm day, solar collapses and the battery drains. The Strategy Lab runs the same week twice: proportional sharing leaves the clinic short; essential-first keeps the vaccine fridge powered and sheds flexible loads instead.                                                   |
| 04  | 30    | Why? I ask the copilot — this is a live call to Meta's Muse Spark. It answers through engine tools, and every number points to the simulation run that produced it. It never invents one.                                                                                                                                  |
| 05  | 52    | Now let the AI drive. In autonomous mode, the action chosen by the engine applies on its own, inside the village rules. It shifts flexible loads, reserves the night battery, and isolates a sector on fire — never re-energising it. Every decision is logged with before-and-after evidence. One tap takes back control. |
| 06  | 34    | Second feature: real objects in the twin. I drop a photo. SAM and Muse Spark find the appliances and buildings, live, outlined and marked as AI perception, to verify. Missing something? I draw it with the magnetic lasso.                                                                                               |
| 07  | 50    | I pick a building. Muse Image imagines a clean front elevation — I add details, retry, and validate. Muse Spark then builds the 3D model piece by piece: massing, roof, openings, accessories. Each stage is scored against the photo, and six imagined views let me check every side.                                     |
| 08  | 44    | Then its load: an AI estimate or my own watts, with the twenty-four-hour curve. I place it on the map, choose its feeder line, and insert it. The model now stands in the 3D village, and every strategy is recomputed with its consumption.                                                                               |
| 09  | 24    | A deterministic engine for every number. Meta models for perception, language and imagination. And a human who can always take back control.                                                                                                                                                                               |
| 10  | 8     | Mitsinjo Grid. Simulated data, real decisions.                                                                                                                                                                                                                                                                             |

Captions (`subtitles/en.srt`): one cue per sentence, ≤ 2 lines × 42 characters, timed from the final voice
track (not from § 4 estimates).

---

## 6. Capture scenarios (shot list)

### Setup (once)

1. Free disk ≥ 5 GB (raw 1080p ≈ 40 MB/min) and close other apps (the 3D needs ≥ 6 GB free RAM).
2. `.env`: `LLM_PROVIDER=meta` + a valid `META_API_KEY`. The mock shows "Demo detections (offline sample)",
   which must never appear. Check the Meta spend cap before the B-shots. The key never appears on screen.
3. `make dev` (port from `.env`), stdout tee'd to `video/captures/raw/server.log` for the L-shots and for
   provenance. Dark theme, English, desktop. Clear localStorage before the first take.
4. Browser: Playwright Chromium **headed**, `--ignore-gpu-blocklist --enable-gpu-rasterization --use-angle=gl`,
   window at screen (0,0), **viewport 1280 × 720 with `deviceScaleFactor: 1.5`** → 1920 × 1080 real pixels on
   screen: layout stays 720p, zooms in post stay sharp. Hide scrollbars.
5. Cursor: inject an overlay `<div>` (≈ 48 px arrow, follows `mousemove`, scales 0.9 on `mousedown`); record
   with `-draw_mouse 0`. Move with `page.mouse.move(x, y, { steps: 30 })`, 400 ms before a click, 600 ms after.
6. Each shot = one Playwright `test.step` writing `shot-id start/end` + ms timestamp to
   `captures/raw/markers.json`; `record-region.sh` records the whole run; `build.sh` cuts by markers.
7. Selectors: roles + the English labels below (`apps/web/src/messages/en.json`); confirm each with `rg`
   before scripting — labels change.

### Hook and live-call proof

| Shot | Where                      | Steps                                                                                                                                 | Keep      |
| ---- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| H1   | `/overview`, `/simulation` | Overview cards 3 s; Live Simulation 3D village slow orbit (golden hour) 7 s.                                                          | 10 s      |
| L1   | terminal + `/copilot`      | Model picker open on `muse-spark-1.3`; server-log lines `[copilot:meta] …` / `[copilot:loop] Loop finished successfully …` during A7. | 2 s inset |
| L2   | terminal                   | `[vision] …` lines during B1 (detection) — crop to the line, hide paths and any env value.                                            | 2 s inset |
| L3   | app                        | AI steps list with live `{s} s` timings and `[copilot:meta] Image generated successfully by Meta API in {ms}ms` during B3.            | 2 s inset |
| R1   | `/simulation`              | Slow 3D orbit of the village with the inserted model, no clicks (bed for the recap overlays).                                         | 14 s      |

### Feature A — the 7-day village

| Shot | Route                        | Steps (exact UI labels)                                                                                                                                                               | Keep / speed           |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| A1   | `/simulation`                | **Weather workflow** → **Add day** until `7/7 days` → **Weather for Day n**: D1 Sunny, D2 Sunny, D3 Partly cloudy, D4 Storm, D5 Rainy, D6 Cloudy, D7 Sunny.                           | 6 s, zoom on panel     |
| A2   | `/simulation`                | Toggle **Chaos mode**; hold on the `{count} incidents` chip.                                                                                                                          | 2 s, macro zoom        |
| A3   | `/simulation`                | Open **Power Allocation Strategy**, hover Proportional → Balanced → Essential first, pick **Essential first**.                                                                        | 3 s                    |
| A4   | `/strategies`                | Strategy parameters (PZ): clinic lifeline floor, night battery reserve, sector priorities, one sector cap — one control each, 1 s per close-up.                                       | 8 s, 4 macro close-ups |
| A5   | `/simulation`                | **Start timeline playback**; 7 days run; 3D day/night; D4 pill turns critical (`Day 4: Storm, essential services short`).                                                             | ×8 → 12 s              |
| A6   | `/strategies`                | Side-by-side on the same week: Proportional vs Essential first; zoom on clinic coverage and unserved.                                                                                 | 8 s                    |
| A7   | `/copilot`                   | Ask _"Why does the clinic get less energy?"_; answer streams; zoom on **Computed evidence** + `SIM-…` id.                                                                             | ×2 on streaming → 11 s |
| A8   | `/scenarios` → `/simulation` | **My Custom Scenarios** → the 7-day scenario → **Launch in autonomous AI mode** (or **Dispatch mode** → **Autonomous AI**); hold on **AI IN CONTROL**.                                | 4 s                    |
| A9   | `/simulation`                | Playback; **Event Log** fills (All / Incidents / Actions); open one entry: **Before / After**, **Engine evidence**; **Report a fire** → a sector → `FIRE: … cut off`, 3D sector dark. | ×6 → 12 s              |
| A10  | `/simulation`                | **Take back control** → Manual; **Shift report** (`Shift Report — Day n`, `{count} autonomous intervention(s) analyzed`).                                                             | 6 s                    |

### Feature B — photo → 3D → village (advanced)

Use a real photo of a small Malagasy-style building (author's own photo — rights) or the sample
`apps/web/public/samples/vision-room.jpg` for appliances. Record the full run live once; long waits are cut or
sped up in post — never fake a result.

| Shot | Route         | Steps (exact UI labels)                                                                                                                                                                                                  | Keep / speed   |
| ---- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| B1   | `/village`    | **Add appliances from a photo** → **Choose a photo** (or **Use the sample room**) → `Looking for appliances…` → outlines → `{count} detected`, **AI perception · to verify**.                                            | wait ×10 → 5 s |
| B2   | `/village`    | **Draw missing objects** → **Magnetic lasso** → trace one object → **What is it?** "water pump" → **Send the object**.                                                                                                   | 4 s            |
| B3   | `/village`    | Select a building → **2D Facade** → _"red tin roof, wooden door, blue shutters"_ → **Imagine 2D facade** → **Retry with details** once → **Validate & Generate 3D**.                                                     | wait ×10 → 7 s |
| B4   | `/village`    | **3D model**: AI steps (Extracting the object… → Muse Spark imagines the parts and colours → Fitting the parts…), then **Massing → Roof → Openings → Accessories**, `Stage score {before} → {after}`, `Model finalised`. | ×10 → 7 s      |
| B5   | `/village`    | **Imagined 2D views (6 angles)**: Front (0°), Left side (90°), Back (180°), Right side (270°), Top view, 3/4 Isometric.                                                                                                  | 3 s            |
| B6   | `/village`    | Drag to turn; **Model size**, **Tint**; zoom on `Materials (AI): …` and `Matches the photo outline: {pct}`.                                                                                                              | 4 s            |
| B7   | `/village`    | **Configure Load & Insert** → **AI estimate** vs **Manual** → **Power per unit (W)**, **Quantity** → **24 h load curve** + `Engine: peak {peak} · {daily} per day`.                                                      | 7 s            |
| B8   | `/village`    | **Place on the map** → `Placed: x, z` → **Feeder line** Auto → a named feeder → **Insert into simulation** → `In the simulation: strategies re-computed.`                                                                | 6 s            |
| B9   | `/simulation` | Orbit to the inserted model on its plinth; scrub day → night (model dims when idle/unserved).                                                                                                                            | 9 s            |

Stills for the splash / outro carousel: `make shots` (dev server running) → `design/shots/`; copy dark ones to
`video/images/` (`scale=1280:-2`). Recap values = numbers read in A6, A9, B8 → `output/values.md`.

---

## 7. Canvas & overlays (`video/canvas/`)

- Plain HTML + CSS + Web Animations API, no CDN, the app font copied locally; 1280 × 720 stage.
- Each page exposes `window.__duration` (ms) and `window.__seek(ms)` (sets `currentTime` on every
  `document.getAnimations()`) → deterministic frames.
- `render-canvas.mjs <page> <out-dir>`: Playwright 1280 × 720, `deviceScaleFactor: 1`, `t += 1000/30`,
  `__seek(t)`, screenshot → `frames/<page>/%05d.png`; overlays with `omitBackground: true` (alpha).
- English text may be hard-coded here: video assets are not app UI (the i18n rule covers `apps/web`).
- Icons: inline SVG from `video/icons/`, stroke `currentColor`, colours from § 2.
- Splash / outro carousel accent: 6 cards, `rotateY(i·60°) translateZ(r)`, ring rotates 0 → −40°,
  `perspective: 1400px`, shading gradient for the curve, 25 % flipped reflection under the ring.

---

## 8. Post-production pipeline (`scripts/build.sh`)

1. **Cut** the run recording by `markers.json` into `captures/clips/<shot>.mp4`.
2. **Scale & zoom:** 1920 × 1080 → 1280 × 720 (`scale=…:flags=lanczos`); macro close-ups = animated `crop`
   of the panel (max 2×, stays sharp).
3. **Speed ramps:** `setpts=PTS/N` per § 6; drop capture audio; no frame interpolation (keeps UI crisp).
4. **Overlays:** PNG sequences composited with `overlay`; L-shot insets = 520 px wide, bottom-left, 8 px
   radius, 200 ms fade.
5. **Transitions:** 8-frame `xfade` (`fadeblack` at chapter starts, `smoothleft` inside a chapter).
6. **SFX** (generated, no download): click = 30 ms 2.2 kHz sine, fast decay; whoosh = 0.5 s band-passed pink
   noise with fade; rise = 1.2 s sine sweep 200 → 800 Hz. Click −18 dB, whoosh −20 dB.
7. **Voice:** place `vo-00…vo-10` at segment starts; `highpass=80`, `afftdn`, light compressor, `loudnorm`
   −16 LUFS → `audio/voice/vo-full.wav`.
8. **Music:** 2:43 < 2:58 → concat a second copy with a 3 s `acrossfade` on a phrase boundary; `afade` in 1 s /
   out 4 s; bed −20 dB, **ducked** under the voice (`sidechaincompress`, threshold −30 dB, ratio 8, release
   400 ms); up to −12 dB where there is no voice.
9. **Captions:** burn `subtitles/en.srt` (app font 30 px, white, 70 % canvas box, margin 48 px) and mux soft.
10. **Encode:** `libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 30 -movflags +faststart` (`h264_nvenc
-cq 19` for drafts), `aac 192k`; −14 LUFS integrated, true peak ≤ −1 dBTP.

Author's PC (checked 2026-11-03): i7-4750HQ, 16 GB, GTX 960M 2 GB (NVENC), X11 1920 × 1080, ffmpeg with
libx264 + h264_nvenc, OBS, Blender. 720p capture and render are fine; free RAM and disk are the limits.

---

## 9. Quality checklist (before upload)

- [ ] First words = provenance line (segment 00); duration ≤ 3:00.
- [ ] ≥ 90 % real screen footage; live Meta calls visible (model picker + log insets L1–L3).
- [ ] Demo path (drop → comparison → explanation → evidence) on screen.
- [ ] `SIMULATED DATA` visible in every app shot, splash and outro.
- [ ] No mock text ("Demo detections", "offline"), no API key, no `.env`, no home path on screen.
- [ ] Every overlay number matches a captured value (`output/values.md`).
- [ ] Music credited in the outro and in `README.md`; every other asset is ours or CC0.
- [ ] Captions match the voice; no caption hides a number being explained; readable on a phone at 720p.
- [ ] Loudness −14 LUFS; voice clear over music on laptop speakers.
- [ ] Backup take rendered; video link in `README.md` (P9-T5) before 6:00 PM ET, Nov 4.
