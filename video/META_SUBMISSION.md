# Meta AI Hackathon — submission form answers

## Project Description\*

Mitsinjo Grid is an AI copilot for a simulated rural solar microgrid in Madagascar. One microgrid powers a clinic, a school, water and every home. When the sun drops, the operator has to decide who keeps the light.

The operator builds a simulated week (sun, clouds, storms, random incidents in chaos mode) and sets the levers: dispatch strategy, clinic lifeline floor, night battery reserve, sector priorities and caps. The whole week plays in seconds across three views: a 3D village through day and night, a power topology from the solar hub to each sector, and a circuit view with every breaker. The Strategy Lab compares strategies on the same event. For example, with 70% less sun for 10 hours, proportional sharing gives the clinic 44% of its energy and essential-first raises it to 58%.

The operator can ask the copilot by voice ("Who loses power first?"). Muse Spark answers by calling the engine's tools, and every number in the answer links to the simulation run that produced it. In autonomous mode, the engine picks and applies each action inside the village rules: it shifts flexible loads, keeps the night battery reserve and isolates a sector on fire. Muse Spark explains every decision, and one tap takes back control.

The operator can also bring real objects into the digital twin. From a photo, Muse Spark names the buildings and appliances and SAM 3.1 outlines them. Muse Image draws a clean front elevation of a building. Muse Spark builds its 3D model in stages and scores each stage against the drawing. The operator then sets the object's load, places it on a feeder line, and every strategy is recomputed with its consumption.

Key rule: numbers come only from a deterministic TypeScript engine. The AI explains, proposes and drives, but never invents an energy value. All data is simulated. The app runs in English, French and Malagasy, in dark and light themes, on mobile and desktop.

Built solo from scratch during the hackathon (first commit Oct 26, 2026).

Live app: https://mitsinjo-grid.vercel.app/simulation

## Public GitHub Repository\*

https://github.com/Tokiarivelo/mitsinjo-grid

## Minute Demo Video\* (YouTube)

https://youtu.be/GSu96kD7HRw

## Describe your use of Meta products to build the submitted project\*

All AI in Mitsinjo Grid runs on the Meta Model API. Each model has one job:

- **Muse Spark (muse-spark-1.3):** the copilot's brain. It uses OpenAI-compatible chat with tool calling to query the simulation engine (grid state, strategy comparison, warnings), then explains the results in plain words with evidence links. It also explains each decision in autonomous dispatch mode. Spark chooses which other Meta model to call through tool calls (generate an image, segment a photo), never through keyword rules. On photos, it uses vision with a JSON schema output to name buildings and appliances, identify objects the operator draws with a lasso, and build 3D models as a staged recipe (massing, roof, openings, accessories), scoring each stage against the 2D drawing.
- **Muse Voice (muse-voice-transcribe-1.0):** chat microphone input. Speech becomes text in English, French or Malagasy before going to Spark.
- **SAM 3.1:** pixel-precise outlines of each detected object on an uploaded photo, matched to Spark's boxes by overlap. It also outlines the parts of an object (windows, doors, roof) on its 2D view so the 3D model is measured, not guessed.
- **Muse Image (muse-image-1.0):** draws a clean, unoccluded front elevation of a selected building, which seeds its 3D model. The operator can add details, retry and validate. It also makes illustrated load-shedding posters in French and Malagasy.
- **Muse Wonder (muse-wonder-1.0):** an optional final check and refinement stage of the 3D model loop, and deep reasoning in the copilot.

Every remote call has a timeout and a local fallback, so the demo path still works if a model is slow or unavailable. AI perception is always labelled "to verify", and AI text is visually separate from computed metrics.

## Why are Meta's models important to your solution?\*

A village microgrid operator is not an energy engineer. They need answers in their own language, by voice, about their own village. Meta's models make that possible in one API:

- **Muse Spark's tool calling** lets the AI answer from the engine instead of from memory. The model reasons and explains, the engine computes, and every number can be checked. That is what makes an AI copilot safe enough to drive a grid that feeds a clinic.
- **Muse Voice** removes the keyboard barrier: the operator asks "who loses power first?" out loud, in English, French or Malagasy.
- **SAM 3.1, Muse Image and Spark vision** turn a phone photo of a real village into objects in the digital twin. A community can model its own houses and appliances without CAD tools or an engineer on site.
- **Using one provider for every modality** (text, vision, voice, segmentation, image) kept the architecture simple for a solo builder in 10 days. One client, one auth and one cost cap cover everything, and Spark routes between the models itself.

Without these models, Mitsinjo Grid would be a simulator with charts. With them, it becomes a copilot that listens, explains, acts within rules and gives control back to the human.

## Provide feedback from your experience using partner technologies.

**What worked well**

- The OpenAI-compatible chat endpoint made Muse Spark easy to plug in, and its tool calling was reliable on multi-step engine questions.
- JSON-schema output on vision calls gave clean, parseable detections.
- SAM 3.1 outlines were precise and fast enough to run in parallel (one call per label).
- Muse Image followed precise orthographic prompts well for clean facade drawings.
- Muse Voice handled French and Malagasy speech, which matters for rural Madagascar.

**What could be better**

- **No photo-to-3D or text-to-3D model on the API.** `GET /models` lists no 3D model (no SAM 3D Objects), so 3D had to be built indirectly (see the obstacle below).
- **Latency on vision:** Spark needs about 15–25 s per image analysis, so timeouts had to be raised from 20 s to 60 s, with progress events streamed to the UI.
- **Long reasoning on open-ended tasks:** a free 12-part 3D recipe made Spark think for more than 60 s on a simple stone cottage. Tight, constrained prompts were needed.
- **Muse Wonder can time out** on a final-check stage, so it had to stay optional.
- `tool_choice` only supports `auto`, so a specific tool cannot be forced.
- Muse Voice accepts WAV only, so the browser has to convert audio before upload.
- Contributor model ids were slower and rate-limited, so I used standard model ids.
- Clearer docs on per-model latency, limits and pricing would help planning.

## What was the obstacle?

**Generating 3D models with the Meta models.**

I wanted the operator to take a photo of a real building and see it appear as a 3D model in the simulated village. The Meta Model API has no photo-to-3D or text-to-3D model. It lists Muse Spark, Muse Image, SAM 3.1 (2D masks), Muse Voice and Muse Wonder, but nothing that outputs a mesh. So I had to build 3D from 2D understanding, using only Meta models:

1. **Muse Image** draws a clean front elevation of the selected building, without people, trees or perspective in the way. The operator can add details, retry and validate it.
2. **SAM 3.1** outlines the building and its parts (roof, windows, doors) on that drawing, so sizes and positions are measured, not guessed. Colours and the roofline are measured from the pixels too.
3. **Muse Spark** builds the model as a recipe of simple parts (boxes, cylinders, cones) in stages: massing, roof, openings, accessories. Each stage is rendered and scored against the drawing, and a stage is kept only if the score does not go down.
4. **Muse Wonder** optionally does a final check.

The hard parts were:

- **Free-form recipes were too slow and unreliable.** Spark sometimes thought for over 60 s and returned parts that floated or overlapped. I switched to building-type templates with measured values, so Spark chooses and adjusts instead of inventing every part.
- **The API is slow for a live UI.** Each vision call took 15–25 s, so the server streams each stage as it finishes and keeps refining in the background, and the user sees the model improve step by step.
- **Pasting the photo on the 3D model looked wrong.** I use small tileable texture swatches taken from the photo instead.
- **Every step needed a fallback**: a timeout, a spend cap or a bad answer falls back to a 3D model extruded from the SAM outline, so the demo never breaks.

The result is a usable photo → 2D drawing → 3D model → simulation pipeline built only with Meta models. A native 3D generation model on the Meta API would make this much simpler and more faithful.
