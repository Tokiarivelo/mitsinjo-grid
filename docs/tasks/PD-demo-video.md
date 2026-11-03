# PD — 3-minute demo video (closes P9-T5)

**Read first:** `video/VIDEO_PLAN.md` (whole file — it is the spec) · `HANDOFF.md`.
Do not load `docs/demo-script.md` (older narrative, superseded).

Deadline: submission **Wed Nov 4, 9:00 PM ET**, no edits after. Video link in the README by 6:00 PM ET.
All work in `video/` (layout: plan § 3). New commands → Makefile targets in a new `##@ Video` section.

## PD0 — Rules and repo (before recording)

- [x] **PD-T0** Hackathon rules (plan § 0): the author confirms that the event started on or before
      Oct 26, 2026 (first commit). Otherwise pre-event code must move to its own repo, pinned and downloaded by a
      script, and both the README and segment 00 change. **Done when** the README provenance line and voice-over 00
      say the same thing and are true.
- [x] **PD-T1** README: music credit ("Passion" — Luke Bergs & AgusAlvarez, Free To Use Music; free to use, no
      license required) in a "Video credits" section; video line 15 points to
      `video/VIDEO_PLAN.md` until the link exists. **Done when** `rg -n "Luke Bergs" README.md` hits.
- [ ] **PD-T2** Live provenance: keep the `server.log` of the recording run (with key and paths removed) and the
      copilot traces as `docs/provenance/` samples, linked from the README keyless-mode note. **Done when** a judge
      without a key can see recorded live Meta outputs.

## PD1 — Assets and tooling

- [ ] **PD-T3** `video/canvas/`: `shared.css`, `timeline.js` (`__seek`, `__duration`), `00-splash.html`,
      `10-outro.html`, `overlays/{chapter,lower-third,recap-card}.html`; `video/icons/*.svg` (plan § 3 list).
      **Done when** each page renders the same frame twice for the same `__seek(t)`.
- [ ] **PD-T4** `video/scripts/render-canvas.mjs` + `make video-canvas` → `video/frames/<page>/%05d.png`
      (overlays with alpha). **Done when** splash and outro play at 30 fps with `ffplay`.
- [ ] **PD-T5** SFX with ffmpeg only (plan § 8.6) → `video/audio/sfx/`; `make video-sfx`.

## PD2 — Capture (live Meta, author's PC)

- [ ] **PD-T6** `video/scripts/capture.spec.ts` (headed Chromium + GPU, viewport 1280 × 720 at DPR 1.5,
      big-cursor overlay, `markers.json`) + `record-region.sh` (x11grab, NVENC, `-draw_mouse 0`) +
      `make video-capture`. Shots H1, L1–L3, R1, A1–A10, B1–B9 (plan § 6). **Done when** one dry run with
      `make dev-mock` gives every shot id in `markers.json`.
- [ ] **PD-T7** (human) Live take with `LLM_PROVIDER=meta` (+ backup take); check no mock text, no key on screen;
      fill `video/output/values.md` with every number used in overlays and the voice-over.

## PD3 — Voice, edit, deliver

- [ ] **PD-T8** (human) Record voice-over `vo-00…vo-10` (plan § 5, `{…}` replaced from `values.md`).
      Fallback only if impossible: Meta MMS-TTS locally. `subtitles/en.srt` from the final voice timing.
- [ ] **PD-T9** `video/scripts/build.sh` + `make video-build`: cuts, zooms, ramps, overlays, music loop + ducking,
      captions, encode → `video/output/mitsinjo-grid-demo-720p.mp4` (+ `-backup.mp4`). **Done when** plan § 9
      checklist passes and the duration is ≤ 3:00.
- [ ] **PD-T10** (human) Upload, put the link in README line 15, tick P9-T5; then P9-T6 (submit, tag `v1.0.0`,
      the one X post for Most Viral).

**Exit criteria:** a ≤ 3:00 720p video that opens with the provenance line, is ≥ 90 % live footage with live
Meta calls visible, shows both features (7-day village + Autonomous AI; photo → 3D → village), credits its
music, and is linked from the README before the deadline.
