#!/usr/bin/env python3
"""Order a picture from `wave` for Rex & Nova: Space Voyagers II (the art lab's batches).

    python3 scripts/voyagers2-lab/art/gen.py NAME --prompt-file scripts/voyagers2-lab/art/prompts/x.txt
                                           [--format 1:1] [--images canvas.png style.png]

The picture lands in tmp/voyagers2-art/raw/NAME.png (git-ignored) and one line goes to
scripts/voyagers2-lab/art/log.jsonl: name, model, size, prompt, inputs, seconds. Nothing is
uploaded (`--no-upload`). The model is gpt-image-2.5 on WaveSpeed (`flare`; with --images the
edit model `flare-edit`), paid, about $0.04 a picture. The key is read from the environment
(WAVESPEED_KEY) and never printed.

`{name}` in a prompt is replaced by prompts/blocks/name.txt, so every prompt carries the same
words for the style and for what to leave out. The recipe is the one of Nova's Solo Rescue
(~/github/nova/tools/art/README.md).

Every order is logged, also one that failed (`"failed": true`), with the batch it belongs to
(`"batch"`; lines without one are batch 1). The cap is per batch (CAPS: 45 for batch 1, 40 for
batch 2) and counts every order of the batch logged plus orders still out, so four orders at
once cannot run past it. A failed order counts too (it may have been billed): the cap is on
orders, not on pictures. ART_BATCH in the environment picks the batch (default 2).
"""
from __future__ import annotations

import argparse
import fcntl
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
RAW = os.path.join(ROOT, "tmp", "voyagers2-art", "raw")
WORK = os.path.join(ROOT, "tmp", "voyagers2-art", "work")
LOG = os.path.join(HERE, "log.jsonl")
LOCK = os.path.join(ROOT, "tmp", "voyagers2-art", "gen.lock")
OUT_FILE = os.path.join(ROOT, "tmp", "voyagers2-art", "out.json")
BLOCKS = os.path.join(HERE, "prompts", "blocks")
BATCH = int(os.environ.get("ART_BATCH", "2"))
CAPS = {1: 45, 2: 40}
CAP = CAPS.get(BATCH, 40)


def ordered() -> int:
    """Orders made in this batch, failed ones too."""
    if not os.path.exists(LOG):
        return 0
    n = 0
    with open(LOG) as f:
        for line in f:
            if line.strip() and json.loads(line).get("batch", 1) == BATCH:
                n += 1
    return n


def fill(prompt: str) -> str:
    def block(m):
        with open(os.path.join(BLOCKS, m.group(1) + ".txt")) as f:
            return " ".join(fill(f.read()).split())
    return re.sub(r"\{([a-z0-9_-]+)\}", block, prompt)


class locked:
    def __enter__(self):
        os.makedirs(os.path.dirname(LOCK), exist_ok=True)
        self.f = open(LOCK, "a+")
        fcntl.flock(self.f, fcntl.LOCK_EX)
        return self

    def __exit__(self, *a):
        fcntl.flock(self.f, fcntl.LOCK_UN)
        self.f.close()


def out_now() -> dict:
    """Orders still out: name -> start time. Stale after ten minutes."""
    try:
        with open(OUT_FILE) as f:
            d = json.load(f)
    except Exception:
        d = {}
    return {k: v for k, v in d.items() if time.time() - v < 600}


def out_set(d: dict) -> None:
    with open(OUT_FILE, "w") as f:
        json.dump(d, f)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("name")
    ap.add_argument("--prompt-file", required=True)
    ap.add_argument("--format", default="1:1")
    ap.add_argument("--images", nargs="*")
    ap.add_argument("--quality", default="low")
    ap.add_argument("--resolution")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry", action="store_true", help="print the prompt, order nothing")
    a = ap.parse_args()

    with open(a.prompt_file) as f:
        prompt = fill(" ".join(f.read().split()))
    if a.dry:
        print(prompt)
        return 0
    out_png = os.path.join(RAW, a.name + ".png")
    if os.path.exists(out_png) and not a.force:
        print(f"gen: {a.name} is there already (--force to make it again)")
        return 0
    for p in a.images or []:
        if not os.path.exists(p):
            print(f"gen: {a.name}: no such input {p}")
            return 1
    with locked():
        out = out_now()
        if ordered() + len(out) >= CAP:
            print(f"gen: the cap of {CAP} orders is reached")
            return 1
        out[a.name] = time.time()
        out_set(out)

    work = os.path.join(WORK, f"{a.name.replace('/', '_')}-{int(time.time() * 1000)}")
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
    ok = p.returncode == 0 and bool(made)
    size = None
    if ok:
        os.makedirs(os.path.dirname(out_png), exist_ok=True)
        from PIL import Image
        src = made[0]
        if os.path.splitext(src)[1].lower() != ".png":
            Image.open(src).convert("RGB").save(out_png)
        else:
            shutil.copyfile(src, out_png)
        size = list(Image.open(out_png).size)
    rec = {
        "name": a.name, "batch": BATCH, "model": model, "format": a.format, "quality": a.quality,
        "resolution": a.resolution, "size": size, "failed": (not ok) or None,
        "images": [os.path.relpath(os.path.abspath(i), ROOT) for i in (a.images or [])] or None,
        "prompt_file": os.path.relpath(os.path.abspath(a.prompt_file), ROOT),
        "prompt": prompt, "seconds": secs, "made": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    with locked():
        with open(LOG, "a") as f:
            f.write(json.dumps({k: v for k, v in rec.items() if v is not None}) + "\n")
        out = out_now()
        out.pop(a.name, None)
        out_set(out)
        n = ordered()
    if not ok:
        tail = (p.stdout + p.stderr)[-1200:]
        key = os.environ.get("WAVESPEED_KEY")
        if key:
            tail = tail.replace(key, "***")
        print(f"gen: {a.name} failed after {secs}s\n{tail}")
        return 1
    print(f"gen: {a.name} {size} {model} in {secs}s (batch {BATCH}: order {n} of {CAP})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
