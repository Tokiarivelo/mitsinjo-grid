#!/usr/bin/env bash
# Load the root .env (e.g. STITCH_API_KEY) into your terminal.
#   source scripts/env.sh              # bash/zsh: exports into the current shell
#   eval "$(make -s env-export)"       # same, via make (prints `export K=V` lines)
# Values are never echoed when sourced; only variable names are listed.

_mg_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
_mg_env="$_mg_root/.env"

if [ ! -f "$_mg_env" ]; then
  echo "No $_mg_env — cp .env.example .env and fill it." >&2
  unset _mg_root _mg_env
  return 1 2>/dev/null || exit 1
fi

_mg_names="$(sed -nE 's/^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=.*/\2/p' "$_mg_env")"

set -a
. "$_mg_env"
set +a

if [ "$1" = "--print" ]; then
  # Executed (not sourced): print shell-safe export lines for eval.
  for _mg_k in $_mg_names; do printf 'export %s=%q\n' "$_mg_k" "${!_mg_k}"; done
else
  echo "Exported from .env:" $_mg_names >&2
fi

unset _mg_root _mg_env _mg_names _mg_k
