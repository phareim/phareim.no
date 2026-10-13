#!/usr/bin/env python3
"""Order a picture from `wave` for Nova & Rex' Drive to the Mountains.

    python3 scripts/outrun-lab/art/gen.py NAME --prompt-file scripts/outrun-lab/art/prompts/x.txt
                                           [--format 1:1] [--images canvas.png style.png]

The picture lands in tmp/outrun-art/raw/NAME.png (git-ignored) and one line goes
to scripts/outrun-lab/art/log.jsonl: name, model, size, prompt, inputs, seconds.
Nothing is uploaded (`--no-upload`). The model is gpt-image-2.5 on WaveSpeed
(`flare`; with --images the edit model `flare-edit`), paid, about $0.04 a picture.
The key is read from the environment (WAVESPEED_KEY) and never printed.

`{name}` in a prompt is replaced by prompts/blocks/name.txt, so every prompt
carries the same words for the style and for what to leave out. The recipe is
the one of Nova's Solo Rescue (~/github/nova/tools/art/README.md).
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
RAW = os.path.join(ROOT, "tmp", "outrun-art", "raw")
LOG = os.path.join(HERE, "log.jsonl")
BLOCKS = os.path.join(HERE, "prompts", "blocks")
CAP = 90


def ordered() -> int:
    if not os.path.exists(LOG):
        return 0
    with open(LOG) as f:
        return sum(1 for line in f if line.strip())


def fill(prompt: str) -> str:
    def block(m):
        with open(os.path.join(BLOCKS, m.group(1) + ".txt")) as f:
            return " ".join(f.read().split())
    return re.sub(r"\{([a-z0-9_-]+)\}", block, prompt)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("name")
    ap.add_argument("--prompt-file", required=True)
    ap.add_argument("--format", default="1:1")
    ap.add_argument("--images", nargs="*")
    ap.add_argument("--quality", default="low")
    ap.add_argument("--resolution")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    out_png = os.path.join(RAW, a.name + ".png")
    if os.path.exists(out_png) and not a.force:
        print(f"gen: {a.name} is there already (--force to make it again)")
        return 0
    if ordered() >= CAP:
        print(f"gen: the cap of {CAP} pictures is reached")
        return 1
    with open(a.prompt_file) as f:
        prompt = fill(" ".join(f.read().split()))

    work = os.path.join(RAW, "_work", a.name)
    if os.path.isdir(work):
        shutil.rmtree(work)
    os.makedirs(work)
    model = "flare-edit" if a.images else "flare"
    cmd = ["wave", "--prompt", prompt, "--format", a.format, "--out", "--no-upload",
           "--model", model, "--quality", a.quality]
    if a.resolution:
        cmd += ["--resolution", a.resolution]
    if a.images:
        cmd += ["--images"] + [os.path.abspath(p) for p in a.images]
    env = dict(os.environ)
    env.pop("WAVESPEED_PATH", None)
    t0 = time.time()
    p = subprocess.run(cmd, cwd=work, env=env, capture_output=True, text=True)
    secs = round(time.time() - t0, 1)
    made = sorted(sum((glob.glob(os.path.join(work, "images", "*." + e)) for e in ("png", "jpeg", "jpg", "webp")), []))
    if p.returncode != 0 or not made:
        print(f"gen: {a.name} failed after {secs}s\n{(p.stdout + p.stderr)[-1500:]}")
        return 1
    os.makedirs(os.path.dirname(out_png), exist_ok=True)
    src = made[0]
    if os.path.splitext(src)[1].lower() != ".png":
        from PIL import Image
        Image.open(src).convert("RGB").save(out_png)
    else:
        shutil.move(src, out_png)
    size = None
    try:
        from PIL import Image
        size = list(Image.open(out_png).size)
    except Exception:
        pass
    rec = {
        "name": a.name, "model": model, "format": a.format, "quality": a.quality,
        "resolution": a.resolution, "size": size,
        "images": [os.path.relpath(os.path.abspath(i), ROOT) for i in (a.images or [])] or None,
        "prompt_file": os.path.relpath(os.path.abspath(a.prompt_file), ROOT),
        "prompt": prompt, "seconds": secs, "made": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    with open(LOG, "a") as f:
        f.write(json.dumps({k: v for k, v in rec.items() if v is not None}) + "\n")
    shutil.rmtree(work)
    print(f"gen: {a.name} {size} {model} in {secs}s (picture {ordered()} of {CAP})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
