#!/bin/sh
# One raw generation to an indexed bitmap in tmp/outrun-art/snap/, through nova's tools/art
# (a Python environment for it lives in ~/.cache/nova-art-venv; see README.md here).
#   sh scripts/outrun-lab/art/snap.sh NAME [snap options…]
name="$1"; shift
exec "$HOME/.cache/nova-art-venv/bin/python" "$HOME/github/nova/tools/art/art.py" snap \
  "tmp/outrun-art/raw/$name.png" -o "tmp/outrun-art/snap/$name.png" "$@"
