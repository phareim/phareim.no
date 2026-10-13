#!/bin/sh
# One raw generation to an indexed bitmap in tmp/galaga-art/snap/, through nova's tools/art.
#   sh scripts/galaga-lab/art/snap.sh NAME [snap options…]
name="$1"; shift
exec "$HOME/.cache/nova-art-venv/bin/python" "$HOME/github/nova/tools/art/art.py" snap \
  "tmp/galaga-art/raw/$name.png" -o "tmp/galaga-art/snap/$name.png" "$@"
