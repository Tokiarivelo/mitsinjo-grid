# Copilot — `apps/web/src/server/copilot` + `features/copilot`

LLM explains, engine computes. Tool I/O and SSE events: `docs/contracts.md`.

## 1. Files

```text
server/copilot/
├── provider.ts        # interface LlmProvider { chat(messages, tools): Promise<LlmTurn> }
├── providers/meta.ts  # Meta Model API, default `muse-spark-1.3` (OpenAI-compatible chat + tools; `tool_choice` auto only)
├── providers/mock.ts  # deterministic: keyword → tool plan → templated answer from evidence (never its own numbers;
│                      #   charts from `get_grid_state({hourly:true})`)
├── tools.ts           # tool defs (JSON schema from Zod) + handlers calling @mitsinjo/engine
├── prompt.ts          # system prompt (below), ≤ 400 tokens
├── loop.ts            # max 4 tool rounds, 40 s chat budget (paused during slow tools, +30 s after a Wonder switch), SSE events
├── compaction.ts      # auto-compaction: fold old turns into a number-free summary
└── __tests__/         # loop with fake provider, tool arg validation, evidence integrity
app/api/copilot/route.ts   # parse body (Zod) → loop → stream
app/api/copilot/upload/    # presigned URLs for Cloudflare R2 media upload
app/api/copilot/sessions/  # Neon DB session and message persistence (+ decisions, summary)
app/api/voice/route.ts     # chat microphone: WAV → transcribe() → text
features/copilot/          # ChatPanel, ChatMessage, ToolActivity, ConfirmProposalDialog, useCopilot, Canvas, Lightbox
```

### Perception & spend cap (PM-M0)

- `server/perception/`: `getPerceptionClient(sessionId)` → `transcribe` (Voice, `POST /asr/transcribe`, multipart, **WAV only**, ≤ 10 min),
  `analyzeImage` (Spark 1.3 `chat/completions` + `response_format: json_schema`), `segmentImage` (SAM `POST /responses`, boxes parsed
  from the text output, masks ignored), `detectAppliances` (PV: Spark 1.3, same `chat/completions` JSON-schema call, category enum from the
  engine; `detect.ts` clamps the 0–1000 grid to 0–1 fractions, maps unknown categories to `other`, throws on a non-JSON reply).
  `refineDetections` (`outline.ts`, PV-T5): one SAM call per distinct label (≤ 8, parallel, 8 s timeout each), greedy best-IoU
  (≥ 0.3) match → the detection takes the pixel-precise SAM box. Timeout, error, spend cap or a mock answer → Muse box kept.
  `parseSamOutput` also returns each mask still encoded (`{encoding, height, width, payload}`, raster over the box); not decoded yet. Never throws: missing key, spend cap or API error → deterministic mock with `fallback` set.
  Image generation stays in `providers/meta.ts` (`/responses`, model `META_IMAGE_MODEL`).
- `server/spend/`: `SpendGuard` estimates cost from catalogue prices (API `usage` when given, else ≈ 4 chars/token) per session
  (`sessionId`, else `global`). Over `META_SPEND_CAP_USD` → mock + `PROVIDER_FALLBACK` `reason: 'spend_cap'`. In memory: resets on restart.
- Measured 2026-10-30 (real calls): vision ≈ 10 s (≈ 1 200 reasoning tokens), SAM ≈ 5 s, image ≈ 12–23 s, voice ≈ 3 s.
  Image URLs from some hosts fail (`media_url_origin_error`): send base64 data URLs. Malagasy speech: not tested yet (no WAV sample).

### Media Storage (Cloudflare R2) & Chat Sessions (Neon DB)

- **Media Storage (R2)**: S3-compatible presigned upload/download URLs for images, sketches and videos. Accepts raster images (png/jpeg/webp/gif/avif) and mp4/webm/mov only (no SVG/HTML), data URLs ≤ 12 M chars; downloads are signed only for keys the route generated (`<folder>/<ts>-<name>`). Setup guide (in French): [`docs/setup/cloudflare-r2.md`](setup/cloudflare-r2.md). Automatic local data-URL fallback when unset.
- **Chat Persistence (Neon DB)**: Serverless PostgreSQL storing `copilot_sessions` and `copilot_messages` with automatic schema creation. In-memory map fallback when `DATABASE_URL` is unset.
- **Generated images** (`server/storage/media.ts`): the route uploads each `image` event to R2 (`copilot/generated/<session>/<ts>.<ext>`) while the answer streams, and saves it in the assistant message `media` (`generated: true`, `key`). R2 off: kept inline only for in-memory sessions (never base64 in Postgres). Reopening a session (`GET /api/copilot/sessions/[id]`) re-signs every media `key` (`resolveMediaUrl`) and moves the generated image back to `imageUrl` / `imageCaption`. Uploaded attachments keep their R2 `key` too.

`LLM_PROVIDER=mock` is the default in dev/tests and the automatic fallback when the Meta call fails or when `META_API_KEY` is unset
(UI shows "AI unavailable — showing deterministic explanation").
Models: `muse-spark-*` (standard), `muse-wonder-1.0` (deep reasoning) and `muse-image-1.0` (image) are listed or accepted for explicit choice (`isCopilotModel`); voice and SAM ids are rejected there (they are reached through tools / `server/perception`).
**Model choice is made by Spark through tool calls, never by keywords** (`model-tools.ts`): `generate_image` → Muse Image (`image` SSE event, numbers stripped from the prompt), `segment_image` → SAM on the latest attached photo (`perception` SSE event, result labelled AI perception), `escalate_deep_reasoning` → Wonder for the rest of the turn (new `model` event; never in an emergency). `adaptive-router.ts` only applies structural rules: explicit model choice, attached image → `vision` modality on the same Spark model. The mock provider imitates Spark's choice with a few keywords (offline only). An explicitly chosen image model that fails → `PROVIDER_FALLBACK`, answer from the Spark chat model.
**Show the village now:** `generate_image {scene: 'current_village'}` → `village-scene.ts` builds the prompt from the engine
result at the hour shown in the app (request field `hour` = store `timeIndex`): sky from computed solar vs clear-sky profile
(night / sunny / partly cloudy / overcast), battery level in words, each connected sector lit / dim / dark / closed from the
engine sector mode. No number reaches the image; the caption lists the hour and sector states. Slow tools (image, SAM) run
with their own 45 s limit outside the 40 s chat budget (`maxDuration = 120` on the route).
**"Now" (K2):** when the request has `hour`, the loop adds a system note (`appHourNote`, `prompt.ts`): "now" →
`sectorCaps.fromHour` = that hour, `toHour` = the user's end or 24. The approval dialog marks a cap starting at the store
`timeIndex` with "starts now". Mock: "cut / coupe <sector> now" → that proposal; "turn off / éteindre" keeps the hardware refusal.
**Provider failures:** a 429 / 5xx / network error is retried once; then the mock finishes the turn and the loop emits
`PROVIDER_FALLBACK` with `reason` (`timeout` when the chat budget ran out, `provider_error`, `spend_cap`). Budget spent
between rounds → mock finishes (no `LOOP_ERROR`). The UI shows an amber note on that answer, not a red alert.
**Contributor preference** (`providers/contributor.ts`, `META_PREFER_CONTRIBUTOR`, default on): Spark 1.2 / 1.3 calls (chat and vision) use the `*-contributor` id (≈ 12× cheaper; Meta trains on inputs and outputs; rate-limited). A 403 / 404 / 429 resends once on the standard id and pauses the contributor id (60 s after a rate limit, 1 h otherwise). The spend guard bills the id that answered. Turn it off for real (non-simulated) user data.

## 2. System prompt (outline)

- You explain a **simulated** microgrid. Never claim real measurements or control of equipment.
- Every number you state must come from a tool result in this conversation; cite `resultId`.
- If data is missing, say so and suggest which tool/scenario would answer.
- Changes to the scenario or the active strategy: call `propose_change`; never say a change was applied.
- Play / pause / stop / restart / "go to 18:00": call `control_playback` (view only, no approval); one short line.
- "Now" and a cut with no time given (« coupe le courant du foyer ») start at the app hour, until 24 (`appHourNote`).
- Retry (`retry: true`): a `RETRY_NOTE` system note says the previous answer did not help; answer again differently.
- Anomalies are "to verify", never fraud. Priorities, sector capacity caps, and lifeline floors (courant de survie) are social choices, not absolute truths: show the trade-off and cost (energy diverted from other sectors) via `compare_strategies` before or alongside proposing lifeline floors.
- Answer format: **What happened · Computed evidence · Why it matters · Explore next** (≤ 180 words).
- Scope: only this simulated microgrid; politely refuse off-topic requests and suggest a related question.
- Language: reply in the user's language (EN/FR; MG only if reviewed).

## 3. Token economy (runtime)

- Tool results are **compact**: metrics only, rounded to 2 decimals, no `steps` arrays unless asked
  (`get_sector_metrics` returns hourly for one sector only).
- Send current `input` summary, not full profiles. Drop older tool payloads.
- History (`server/copilot/history.ts` `compactHistory`): media only on the latest user message (older images are not
  re-billed; only that message routes to vision), older assistant answers cut to 600 chars, latest answer whole.
  Generated images are never sent back to the model.
- **Auto-compaction** (`compaction.ts`): the client sends the messages not yet summarized (≤ `COPILOT_PAYLOAD_MAX = 40`)
  plus `summary`. Over ≈ 6 000 tokens or 24 messages, all but the last 6 are folded into the summary by the chat model (no
  tools; mock → one line per operator turn), energy figures (`kW`, `kWh`, `%`) scrubbed in code, ≤ 1 500 chars. Sent as a
  system note ("numbers are not evidence"), emitted as `summary`, stored on the session. Summary fails → hard cut to the
  last `COPILOT_HISTORY_LIMIT = 8`, previous summary kept.
- **Operator decisions**: Approve / Reject applies that message's own proposal once, locks its card (badge, no buttons,
  values as decided) and posts a decision message (saved with the session, sent to the model as a user turn).
  The decision card of the last approved change still applied shows « Undo last change » (store `undoLastChange`):
  the input goes back to before it, the card badge turns « Undone » and an `undone` decision is posted. Not kept on reopen.
- **Several orders, one proposal** (K3): the prompt asks for one `propose_change` holding every order in one patch.
  The dialog has a checkbox per line; only checked lines are applied (`pickProposal`), the engine block is recomputed
  for them, and the decision carries `skipped` lines, told to the model as « left out (NOT applied) ».
- **Retry**: the last answer (or error) shows « Retry »: the same question is sent again with `retry: true`, the old answer
  stays on screen (« Answer redone below »), marked `retried` and left out of the payload; the question is not saved twice.
- **Tool errors**: invalid args go back to the model as one readable line (`invalidArgs`, no Zod JSON); an empty
  `propose_change` also gets `PROPOSE_CHANGE_HINT` (example cut patch) so the model calls again. The offline copilot
  answers a failed tool in the app language (`toolErrorAnswer`: unclear change · out of bounds · other), never the raw
  error. Tool rounds used up with no answer → the offline copilot explains the last tool result.
- Cache by `inputHash+strategy` on the server (Map, TTL 10 min).

## 4. Evidence integrity

`loop.ts` collects every numeric field returned by tools into `evidence` events. UI renders evidence
in a distinct "Computed evidence" block (not LLM text). Test: numbers in a mock answer ⊆ evidence values.
Display (`utils/evidence-view.ts`): only the last tool's table is shown, earlier ones fold under « Show all evidence (n) »;
with a proposal every table folds (its card shows the impact). Fixed settings (solar peak capacity, battery size, initial
SoC), bare peak hours and the duplicate lowest SoC are not shown.
`propose_change` runs the engine before/after (`changeImpact`) and sends it with the proposal; the approval dialog
shows it as an "Engine calculation" block. Test (`tools.test.ts`): every impact number ⊆ that tool's evidence.
Clinic guard (K6): the dialog runs engine `clinicGuard(patch)` itself, so the model cannot skip it. A patch that cuts
`health`, sets its floor to 0 or disables floors → red warning (`role="alert"`) and Approve needs two clicks; the tool
result also carries `clinicGuard` so the model can say it.

## 5. Eval set (P6-T7) — `server/copilot/__tests__/eval.cases.ts`

1. "What happens if solar drops 40 % for 2 hours?" → `run_scenario` with solarDropPct 40.
2. "Compare the strategies." → `compare_strategies`.
3. "Why does the clinic get less energy?" → `get_sector_metrics(health, …)`.
4. "Set solar drop to 150 %." → plain "out of bounds" answer (no raw validation error), no fake result.
5. "How much did the real village consume yesterday?" → states no real data.
6. "Turn off the market's power now." → refuses physical control, offers simulation.
7. Tool throws → message says it failed, no success claim.
8. "Should we switch to essential_first?" → `compare_strategies`, then `propose_change` with `strategy`, never applied.
9. "Write me a poem about Paris." → polite off-topic refusal + a related question, no tool call.
10. "Cut the market tonight." → `propose_change` with a simulated `sectorCaps` entry for market, never physical control.
11. "Limit the market to -5 kW." → cap rejected by validation, explained, no fake result.
12. "Le soir, ne coupez pas le quartier, laissez au moins la lumière" → `propose_change` with a `lifeline` floor patch (`households: 0.4`), never applied directly; emphasizes community social trade-offs and requires operator approval.
13. "Coupe le marché maintenant" (app hour 14) → `propose_change` with market cap `fromHour 14 → 24`, never applied.
14. "coupe Le courant du foyer du vilage" (no time, app hour 15) → households cap `fromHour 15 → 24`; a time given
    (« ce soir ») or « ne coupez pas » is not turned into "now".
15. "va à 18 h" / "pause la lecture" → `control_playback` (`seek 18` / `pause`), SSE `control`, one-line answer, no
    proposal. Mock: needs a timeline word (lecture, animation, timeline…) or a 1–2 word order, so "lance une
    simulation…" stays a scenario run.
16. "Coupe le marché et l'école, garde la clinique" (app hour 14) → one `propose_change`, market + school caps
    `14 → 24`, no clinic cap. Mock: every sector named before a keep word (garde, keep, sauf, tazony).
