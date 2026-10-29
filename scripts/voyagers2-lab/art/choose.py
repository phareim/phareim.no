#!/usr/bin/env python3
"""Which copy of a small sprite ships: the first one nova's gate says yes to.

A packed sheet holds four to twelve copies of every thing, each drawn a little differently.
This cleans every copy the way finish.py does, puts them all through `art gate --kind thing`
and writes pick.json: for each sprite the number of the first copy that passes, or, where
none does, of the copy with the fewest failed checks (those are printed: look at them).
Copy 0 is not written down. A choice made by eye goes in EYE below and wins.

    ~/.cache/nova-art-venv/bin/python scripts/voyagers2-lab/art/choose.py
"""
import glob
import json
import os
import subprocess
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True  # no __pycache__ beside the scripts
sys.path.insert(0, HERE)
import finish  # noqa: E402

TMP = os.path.join(finish.T, "copies")
ART = [os.path.expanduser("~/.cache/nova-art-venv/bin/python"), os.path.expanduser("~/github/nova/tools/art/art.py")]

# Chosen by eye at 4x and 8x, over the gate's choice: sprite -> copy.
EYE = {"face-rat": 3, "face-bear": 7, "face-gorilla": 4, "face-hound": 2, "face-lion": 0, "face-slice": 6,
       "head-rat": 1, "head-bear": 1, "head-gorilla": 2, "head-hound": 3}


def main():
    os.makedirs(TMP, exist_ok=True)
    files, of = [], {}
    for name, (folder, thing) in finish.copies().items():
        for src in sorted(glob.glob(os.path.join(finish.P, folder, thing + "~*.png")),
                          key=lambda p: int(p.rsplit("~", 1)[1][:-4])):
            i = int(src.rsplit("~", 1)[1][:-4])
            a, _, _ = finish.cut_out(src)
            dst = os.path.join(TMP, f"{name}~{i}.png")
            finish.save_indexed(Image.fromarray(a, "RGBA"), dst)
            files.append(dst)
            of[dst] = (name, i)
    out = subprocess.run(ART + ["gate"] + files + ["--kind", "thing", "--json"], capture_output=True, text=True).stdout
    verdicts = {}
    for r in json.loads(out):
        name, i = of[os.path.abspath(r["file"])] if os.path.abspath(r["file"]) in of else of[r["file"]]
        bad = [f"{c['check']} {c['value']}" for c in r["checks"] if not c["ok"]]
        verdicts.setdefault(name, []).append((i, bad, r["size"]))
    pick, none = {}, []
    for name, vs in verdicts.items():
        vs.sort()
        ok = [v for v in vs if not v[1]]
        if name in EYE:
            best = [v for v in vs if v[0] == EYE[name]][0]
        elif ok:
            best = ok[0]
        else:
            best = min(vs, key=lambda v: (len(v[1]), v[0]))
            none.append(f"  {name}: no copy of {len(vs)} passes; taking ~{best[0]} ({'; '.join(best[1])})")
        if best[0]:
            pick[name] = best[0]
    with open(os.path.join(HERE, "pick.json"), "w") as f:
        json.dump(pick, f, indent=1, sort_keys=True)
    print(f"choose: {len(verdicts)} sprites, {len(files)} copies; {len(pick)} take a copy other than 0; {len(none)} pass with no copy")
    print("\n".join(none))


if __name__ == "__main__":
    sys.exit(main())
