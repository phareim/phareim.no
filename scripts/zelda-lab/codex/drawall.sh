#!/bin/bash
# drawall.sh <kit> <try> <sheet>...: draw.sh for each sheet, at most 4 Codex calls at once.
here=$(cd "$(dirname "$0")" && pwd); kit=$1; n=$2; shift 2
printf '%s\n' "$@" | xargs -P 4 -I{} bash "$here/draw.sh" "$kit" {} "$n"
