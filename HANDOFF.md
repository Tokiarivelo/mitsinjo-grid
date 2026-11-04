# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-11-04 · **By:** Claude Code · **Branch:** feat/pd-demo-video

## Current state

- Demo video rendered locally: `video/output/mitsinjo-grid-demo-1080p.mp4` (2:44, 1920 × 1080, −14 LUFS,
  small burned captions without em dashes + soft English track; `video/subtitles/en.srt`). Not committed (gitignored).
- Refined cut: silent splash, no "before the hackathon / this week" lines, Essential 3D view at 0:37, map centred,
  camera flies to and orbits the inserted house, 12 s outro with sunrise end animation + chime.
- 1:45–2:02 reframed on the facade, the 3D viewer and its "stage n/5" chip; A8–A10 re-recorded with
  PR #63 (evidence rounding) and PR #64 (no duplicate autonomous log entries), both merged in main.
- Pipeline (all `make video-*`): `video-tts-setup` / `video-voice` (Kokoro TTS, voice `am_puck`),
  `video-capture PART=a|b` (records the real screen at 1080p, pauses screen lock; hands off while it runs),
  `video-canvas`, `video-sfx`, `video-build [DRAFT=1]` (reads `video/edit.json`).
- Narration lines 03/04/07/09 (plan § 5) match what the take showed: Strategy Lab clinic 43.6 % vs 57.7 %,
  copilot answer (homes then clinic short from the evening). Muse Wonder's final check timed out in the
  take, so the video names 4 Meta models (Voice, Spark, SAM 3.1, Image).

## Next

- PD-T10 (human): upload the video, put the link in README line 15, tick P9-T5; open PR `feat/pd-demo-video`.
- PD-T2: keep `video/captures/raw/server.log` (remove key/paths) as live-call provenance.
- P9-T6: final submission before Wed Nov 4 21:00 ET.

## Files touched (this session)

`video/scripts/{tts.py,lib.cjs,capture.cjs,capture.sh,probe.cjs,render-canvas.cjs,sfx.sh,build.py}`,
`video/canvas/**`, `video/edit.json`, `video/subtitles/en.srt`, `video/VIDEO_PLAN.md`, `video/.gitignore`,
`Makefile` (##@ Video), `README.md` (video credits), `docs/tasks/PD-demo-video.md`, `HANDOFF.md`.

## Decisions

- Voice: Kokoro TTS (non-Meta, local) at the author's request; exception to "Meta models only" for narration.
- Capture on the real display: Xvfb drops to ~10 fps at 1080p; Chromium uses `--use-angle=gl` (Vulkan has no
  WebGL on the real screen). Capture hides the Next dev badge, fire toasts and the big critical banner.
- Final mux uses `-t <total>`, not `-shortest` (it stopped at the last caption and cut the outro).
- App bugs seen in takes are fixed in PR #63 / #64 (merged).
