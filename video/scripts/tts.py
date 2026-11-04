"""Render the voice-over (VIDEO_PLAN.md § 5) with Kokoro TTS, locally.

Usage: tts.py [--voice am_puck] [--speed 1.0] [--only 00,03] [--out audio/voice]
       tts.py --say "Question?" --name mic-question   (one extra line, e.g. the copilot mic question)
Reads the § 5 table so the script text has a single source. One 48 kHz mono WAV per segment,
0.3 s silence head and tail (plan § 5). Run from `make video-voice`.
"""

import argparse
import re
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

VIDEO = Path(__file__).resolve().parent.parent
NAMES = {
    "00": "provenance", "01": "hook", "02": "week", "03": "play", "04": "copilot",
    "05": "autonomous", "06": "detect", "07": "build-3d", "08": "insert", "09": "recap", "10": "outro",
}


def read_lines() -> dict[str, str]:
    plan = (VIDEO / "VIDEO_PLAN.md").read_text()
    section = plan.split("## 5.")[1].split("\n## ")[0]
    rows = re.findall(r"^\|\s*(\d\d)\s*\|\s*\d+\s*\|\s*(.+?)\s*\|\s*$", section, re.M)
    return dict(rows)


def resample(audio: np.ndarray, src: int, dst: int) -> np.ndarray:
    n = int(len(audio) * dst / src)
    return np.interp(np.linspace(0, len(audio) - 1, n), np.arange(len(audio)), audio).astype(np.float32)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="am_puck")
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--only", default="")
    ap.add_argument("--out", default=str(VIDEO / "audio" / "voice"))
    ap.add_argument("--suffix", default="")
    ap.add_argument("--say", default="")
    ap.add_argument("--name", default="mic-question")
    args = ap.parse_args()

    tts = Kokoro(str(VIDEO / "tts" / "kokoro-v1.0.onnx"), str(VIDEO / "tts" / "voices-v1.0.bin"))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    only = set(filter(None, args.only.split(",")))
    pad = np.zeros(int(0.3 * 48000), dtype=np.float32)
    if args.say:
        audio, sr = tts.create(args.say, voice=args.voice, speed=args.speed, lang="en-us")
        audio = np.concatenate([pad, resample(audio, sr, 48000), pad])
        path = out / f"{args.name}.wav"
        sf.write(path, audio, 48000, subtype="PCM_16")
        print(f"{path.name}\t{len(audio) / 48000:.2f}s")
        return
    for seg, text in read_lines().items():
        if only and seg not in only:
            continue
        audio, sr = tts.create(text, voice=args.voice, speed=args.speed, lang="en-us")
        audio = np.concatenate([pad, resample(audio, sr, 48000), pad])
        path = out / f"vo-{seg}-{NAMES[seg]}{args.suffix}.wav"
        sf.write(path, audio, 48000, subtype="PCM_16")
        print(f"{path.name}\t{len(audio) / 48000:.2f}s")


if __name__ == "__main__":
    main()
