#!/usr/bin/env python3
"""Every copy of every small sprite on one sheet, cleaned the way finish.py cleans them, a
row a sprite, enlarged on night blue, for choosing by eye (choose.py's EYE).

    ~/.cache/nova-art-venv/bin/python scripts/voyagers2-lab/art/copies.py [folder] [scale]

writes tmp/voyagers2-art/view/copies-<folder>.png (folder under tmp/voyagers2-art/parts,
default sprites-d).
"""
import glob
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True
sys.path.insert(0, HERE)
import finish  # noqa: E402


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else "sprites-d"
    k = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    rows = []
    for n in finish.SPRITES:
        files = sorted(glob.glob(os.path.join(finish.P, folder, n + "~*.png")),
                       key=lambda p: int(p.rsplit("~", 1)[1][:-4]))
        rows.append((n, [Image.fromarray(finish.cut_out(f)[0], "RGBA") for f in files]))
    cw = max((im.width for _, ims in rows for im in ims), default=1) * k + 8
    ch = max((im.height for _, ims in rows for im in ims), default=1) * k + 8
    per = max(len(ims) for _, ims in rows)
    sheet = Image.new("RGB", (110 + per * cw, len(rows) * ch + 8), (22, 28, 58))
    d = ImageDraw.Draw(sheet)
    for r, (n, ims) in enumerate(rows):
        d.text((4, r * ch + ch // 2), n, fill=(200, 200, 220))
        for i, im in enumerate(ims):
            big = im.resize((im.width * k, im.height * k), Image.NEAREST)
            sheet.paste(big, (110 + i * cw, r * ch + 4), big)
            d.text((110 + i * cw, r * ch + 4), str(i), fill=(255, 255, 0))
    out = os.path.join(finish.T, "view", f"copies-{folder}.png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sheet.save(out)
    print(f"copies: {out}")


if __name__ == "__main__":
    sys.exit(main())
