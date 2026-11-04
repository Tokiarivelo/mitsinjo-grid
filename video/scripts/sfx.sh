#!/usr/bin/env bash
# SFX generated with ffmpeg only (VIDEO_PLAN.md § 8.6) → audio/sfx/.
set -euo pipefail
cd "$(dirname "$0")/../audio/sfx"
ff() { ffmpeg -loglevel error -y "$@"; }
ff -f lavfi -i "sine=f=2200:d=0.03" -af "afade=t=out:st=0.004:d=0.026,volume=0.8" -ar 48000 -ac 2 click.wav
ff -f lavfi -i "anoisesrc=d=0.5:c=pink:a=0.6" -af "bandpass=f=1200:w=900,afade=t=in:d=0.18,afade=t=out:st=0.2:d=0.3" -ar 48000 -ac 2 whoosh.wav
ff -f lavfi -i "aevalsrc='0.5*sin(2*PI*(200*t+250*t*t))':d=1.2" -af "afade=t=in:d=0.2,afade=t=out:st=0.8:d=0.4" -ar 48000 -ac 2 rise.wav
ls
