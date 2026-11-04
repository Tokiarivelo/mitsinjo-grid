#!/usr/bin/env bash
# Record app shots on the real screen (1920×1080, GPU). Keeps the session from blanking or locking while
# it runs and restores the user's setting after. Don't touch mouse or keyboard during the run.
#   capture.sh --part a|b [--only A1,A2] [--dry]
set -euo pipefail
cd "$(dirname "$0")"
old=$(gsettings get org.gnome.desktop.session idle-delay 2>/dev/null | awk '{print $NF}' || true)
restore() { [ -n "$old" ] && gsettings set org.gnome.desktop.session idle-delay "$old" || true; }
trap restore EXIT
[ -n "$old" ] && gsettings set org.gnome.desktop.session idle-delay 0
DISPLAY="${DISPLAY:-:0}" node capture.cjs "$@"
