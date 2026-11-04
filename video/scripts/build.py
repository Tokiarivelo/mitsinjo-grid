"""Assemble the demo video (VIDEO_PLAN.md § 8) from video/edit.json.

python3 build.py [--draft]   → output/mitsinjo-grid-demo-1080p.mp4 (+ subtitles/en.srt, output/timeline.json)

edit.json: {"segments": [{"id", "vo", "canvas"? | "clips": [{"src", "from", "to", "w"?, "zoom"?}],
"overlays": [{"kind", "text", "sub"?, "at", "dur"}], "tail"?}]}. A segment lasts its voice clip + tail;
its clips share that time by weight (speed = source length / allotted time). zoom = [x, y, w] in the
1280 × 720 layout space (×1.5 → 1920 × 1080 pixels), eased in over 0.5 s. Overlays are rendered by render-canvas.cjs (alpha PNGs).
"""

import hashlib
import json
import re
import subprocess
import sys
import urllib.parse
from pathlib import Path

VIDEO = Path(__file__).resolve().parent.parent
RAW, WORK, OUT = VIDEO / "captures/raw", VIDEO / "captures/clips", VIDEO / "output"
FPS, W, H = 30, 1920, 1080
DRAFT = "--draft" in sys.argv


def run(cmd):
    subprocess.run(cmd, check=True)


def ff(*args):
    run(["ffmpeg", "-loglevel", "error", "-y", *args])


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def venc():
    if DRAFT:
        return ["-c:v", "h264_nvenc", "-cq", "23", "-pix_fmt", "yuv420p"]
    return ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p"]


SRC_SCALE = 1.5  # edit.json zoom boxes use 1280 × 720 coordinates; captures are 1920 × 1080


def cut_clip(c, alloc, out):
    src = RAW / f"{c['src']}.mkv"
    span = c["to"] - c["from"]
    speed = span / alloc
    vf = [f"trim=start={c['from']}:end={c['to']}", "setpts=(PTS-STARTPTS)/%.5f" % speed, f"fps={FPS}"]
    if c.get("zoom"):
        # Eased push-in over 0.5 s (15 frames) to the box [x, y, w]; zoompan sizes per frame (ffmpeg 4.4 crop can't).
        x, y, w = [v * SRC_SCALE for v in c["zoom"]]
        z = W / w
        # Already zoomed when the previous clip of the segment was: no push-in from the full frame.
        e = "1" if c.get("held") else "(1-pow(1-min(1,on/15),3))"
        vf.append(f"zoompan=z='1+{z - 1:.4f}*{e}':x='{x:.1f}*{e}':y='{y:.1f}*{e}':d=1:s={W}x{H}:fps={FPS}")
    vf += [f"scale={W}:{H}:flags=lanczos", "setsar=1", f"trim=duration={alloc:.3f}"]
    if c.get("fadein"):
        vf.append("fade=t=in:st=0:d=0.3")
    ff("-i", str(src), "-vf", ",".join(vf), "-an", "-r", str(FPS), *venc(), str(out))


def canvas_clip(page, out):
    frames = VIDEO / "frames" / page
    if not frames.exists():
        run(["node", str(VIDEO / "scripts/render-canvas.cjs"), str(VIDEO / f"canvas/{page}.html"), str(frames)])
    ff("-framerate", str(FPS), "-i", str(frames / "%05d.png"), "-vf", "format=yuv420p", *venc(), str(out))


def overlay_frames(ov):
    q = urllib.parse.urlencode({k: ov[k] for k in ("kind", "text", "sub") if k in ov} | {"dur": int(ov["dur"] * 1000)})
    key = hashlib.md5(q.encode()).hexdigest()[:10]
    d = VIDEO / "frames" / f"ov-{key}"
    if not d.exists():
        run(["node", str(VIDEO / "scripts/render-canvas.cjs"), str(VIDEO / "canvas/overlays/overlay.html") + "?" + q,
             str(d), "--alpha"])
    return d


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


def wrap(text, n=42):
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > n and cur:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    lines.append(cur)
    if len(lines) > 2:  # rebalance into two lines
        half = len(text) // 2
        cut = text.rfind(" ", 0, half + 8)
        lines = [text[:cut], text[cut + 1:]]
    return "\n".join(lines)


def vo_lines():
    plan = (VIDEO / "VIDEO_PLAN.md").read_text()
    section = plan.split("## 5.")[1].split("\n## ")[0]
    return dict(re.findall(r"^\|\s*(\d\d)\s*\|\s*\d+\s*\|\s*(.+?)\s*\|\s*$", section, re.M))


def main():
    edit = json.loads((VIDEO / "edit.json").read_text())
    WORK.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    texts = vo_lines()
    parts, timeline, overlays, cues, t = [], [], [], [], 0.0
    for seg in edit["segments"]:
        vod = duration(VIDEO / "audio/voice" / seg["vo"]) if seg.get("vo") else 0.0  # no vo = music only
        segdur = max(vod + seg.get("tail", 0.5), seg.get("min", 0))
        if "canvas" in seg:
            out = WORK / f"seg-{seg['id']}.mp4"
            canvas_clip(seg["canvas"], out)
            segdur = max(segdur, duration(out))
            parts.append(out)
        else:
            clips = seg["clips"]
            total_w = sum(c.get("w", c["to"] - c["from"]) for c in clips)
            acc = 0.0
            for i, c in enumerate(clips):
                alloc = segdur * c.get("w", c["to"] - c["from"]) / total_w
                alloc = round((acc + alloc) * FPS) / FPS - acc  # frame-aligned
                acc += alloc
                out = WORK / f"seg-{seg['id']}-{i}.mp4"
                c["held"] = i > 0 and "zoom" in clips[i - 1] and "zoom" in c
                cut_clip(c, alloc, out)
                parts.append(out)
            segdur = acc
        timeline.append({"id": seg["id"], "start": round(t, 3), "dur": round(segdur, 3), "vo": seg.get("vo"),
                         "voStart": round(t + seg.get("voDelay", 0), 3)})
        for ov in seg.get("overlays", []):
            overlays.append((overlay_frames(ov), t + ov["at"]))
        # captions: sentences timed by character share of the spoken part
        text = texts.get(seg["id"], "") if seg.get("vo") else ""
        sentences = [s for s in re.split(r"(?<=[.?!])\s+", text) if s]
        speak0, speak1 = t + seg.get("voDelay", 0) + 0.3, t + seg.get("voDelay", 0) + vod - 0.3
        total = sum(len(s) for s in sentences) or 1
        st = speak0
        for s in sentences:
            en = st + (speak1 - speak0) * len(s) / total
            cues.append((st, en, s))
            st = en
        t += segdur

    # 1. concat
    lst = WORK / "concat.txt"
    lst.write_text("".join(f"file '{p}'\n" for p in parts))
    base = WORK / "base.mp4"
    ff("-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(base))

    # 2. captions
    srt = VIDEO / "subtitles/en.srt"
    srt.write_text("".join(f"{i + 1}\n{srt_time(a)} --> {srt_time(b)}\n{wrap(s)}\n\n" for i, (a, b, s) in enumerate(cues)))

    # 3. overlays + burned captions
    inputs, chain, last = ["-i", str(base)], [], "0:v"
    for i, (d, start) in enumerate(overlays):
        inputs += ["-framerate", str(FPS), "-itsoffset", f"{start:.3f}", "-i", str(d / "%05d.png")]
        chain.append(f"[{last}][{i + 1}:v]overlay=eof_action=pass:format=auto[v{i}]")
        last = f"v{i}"
    fonts = VIDEO / "canvas/fonts"
    style = ("FontName=Inter,FontSize=11,PrimaryColour=&H00FFFFFF,BorderStyle=4,BackColour=&H4D1A0D08,"  # small captions
             "Outline=3,Shadow=0,MarginV=12,Alignment=2")
    chain.append(f"[{last}]subtitles={srt}:fontsdir={fonts}:force_style='{style}'[vout]")
    video = WORK / "video.mp4"
    ff(*inputs, "-filter_complex", ";".join(chain), "-map", "[vout]", "-r", str(FPS), *venc(), str(video))

    # 4. audio: voice at segment starts, cleaned; music bed ducked under it; whoosh per segment
    total = t
    ains, voice_parts = [], []
    for i, seg in enumerate(x for x in timeline if x["vo"]):
        ains += ["-i", str(VIDEO / "audio/voice" / seg["vo"])]
        ms = int(seg["voStart"] * 1000)
        voice_parts.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms}[a{i}]")
    n = len(voice_parts)
    voice = WORK / "voice.wav"
    vf = ";".join(voice_parts) + ";" + "".join(f"[a{i}]" for i in range(n)) + \
        f"amix=inputs={n}:normalize=0,highpass=f=80,acompressor=threshold=-20dB:ratio=3:attack=5:release=120," \
        f"loudnorm=I=-16:TP=-1.5:LRA=11,apad=whole_dur={total:.3f}[v]"
    ff(*ains, "-filter_complex", vf, "-map", "[v]", "-ar", "48000", str(voice))

    music = VIDEO / "audio/music/adventure-theme.mp3"
    md = duration(music)
    whoosh = VIDEO / "audio/sfx/whoosh.wav"
    w_in, w_mix = [], []
    for i, seg in enumerate(timeline[1:]):
        ms = int(seg["start"] * 1000)
        w_in += ["-i", str(whoosh)]
        w_mix.append(f"[{i + 3}:a]adelay={ms}|{ms},volume=0.12[w{i}]")
    # End chime when the outro's end scene starts (6.6 s into the last segment).
    chime_ms = int((timeline[-1]["start"] + 6.6) * 1000)
    w_in += ["-i", str(VIDEO / "audio/sfx/chime.wav")]
    w_mix.append(f"[{len(w_mix) + 3}:a]adelay={chime_ms}|{chime_ms},volume=0.5[w{len(w_mix)}]")
    fc = (f"[1:a]asplit[m1][m2];[m2]atrim=start=20,asetpts=PTS-STARTPTS[m2b];"
          f"[m1][m2b]acrossfade=d=3[mus];"
          f"[mus]atrim=duration={total:.3f},afade=t=in:d=1,afade=t=out:st={total - 5:.3f}:d=5,volume=0.32[bed];"
          f"[0:a]asplit[vx][vsc];[bed][vsc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck];"
          + ";".join(w_mix) + ";"
          f"[vx][duck]" + "".join(f"[w{i}]" for i in range(len(w_mix))) +
          f"amix=inputs={2 + len(w_mix)}:normalize=0,loudnorm=I=-14:TP=-1:LRA=11[aout]")
    mix = WORK / "mix.wav"
    ff("-i", str(voice), "-i", str(music), "-i", str(whoosh), *w_in, "-filter_complex", fc, "-map", "[aout]",
       "-ar", "48000", "-t", f"{total:.3f}", str(mix))

    # 5. final mux (soft subtitles too)
    final = OUT / "mitsinjo-grid-demo-1080p.mp4"
    ff("-i", str(video), "-i", str(mix), "-i", str(srt), "-map", "0:v", "-map", "1:a", "-map", "2:s", "-c:v", "copy",
       "-c:a", "aac", "-b:a", "192k", "-c:s", "mov_text", "-metadata:s:s:0", "language=eng", "-movflags", "+faststart",
       "-t", f"{total:.3f}", str(final))  # not -shortest: it stops at the last caption and cuts the outro
    (OUT / "timeline.json").write_text(json.dumps(timeline, indent=2))
    print(f"{final}  {duration(final):.1f}s  (music {md:.0f}s)")


if __name__ == "__main__":
    main()
