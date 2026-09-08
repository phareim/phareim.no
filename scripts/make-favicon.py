"""Neon Dreams favicon for phareim.no — the shared synthwave horizon
(striped sun over a cyan horizon line and a pink perspective grid),
same tokens as themes/base/neonHorizon.js."""
from PIL import Image, ImageDraw, ImageFilter, ImageChops

S, K = 32, 24
W = S * K

PINK   = (0xff, 0x2f, 0xa0)
CYAN   = (0x2f, 0xf3, 0xff)
GOLD   = (0xff, 0xd2, 0x3f)
ORANGE = (0xff, 0x6a, 0x3d)
GROUND = (0x0b, 0x06, 0x16)
DEEP   = (0x06, 0x03, 0x10)
SKY    = (0x17, 0x0a, 0x30)
STAR   = (0xcf, 0xe9, 0xff)

def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))

def render(detail=True):
    img = Image.new('RGB', (W, W), DEEP)
    d = ImageDraw.Draw(img)
    HOR = 21 * K

    for y in range(HOR):
        d.line([(0, y), (W, y)], fill=lerp(DEEP, SKY, (y / HOR) ** 1.4))
    d.rectangle([0, HOR, W, W], fill=GROUND)

    # sun: gold -> orange -> pink, cut by ground-coloured bands, clipped at horizon
    cx, cy, r = 16 * K, 16.6 * K, (9.6 if detail else 10.4) * K
    sun = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sun)
    top = cy - r
    for y in range(int(top), HOR):
        t = (y - top) / (2 * r)
        c = lerp(GOLD, ORANGE, t / 0.55) if t < 0.55 else lerp(ORANGE, PINK, (t - 0.55) / 0.45)
        dx2 = r * r - (y - cy) ** 2
        if dx2 <= 0:
            continue
        dx = dx2 ** 0.5
        sd.line([(cx - dx, y), (cx + dx, y)], fill=c + (255,))
    bands = [(13.6, 0.9), (15.6, 1.15), (17.8, 1.5), (20.0, 1.9)] if detail else [(15.2, 1.5), (18.4, 2.0)]
    for yb, hb in bands:
        sd.rectangle([0, yb * K, W, (yb + hb) * K], fill=(0, 0, 0, 0))
    img.paste(sun, (0, 0), sun)

    # glow
    glow = Image.new('RGB', (W, W), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(0x60, 0x14, 0x38))
    gd.rectangle([0, HOR, W, W], fill=(0, 0, 0))
    img = ImageChops.add(img, glow.filter(ImageFilter.GaussianBlur(2.2 * K)))
    d = ImageDraw.Draw(img)

    if detail:
        for sx, sy, a in [(4.5, 4.0, 1.0), (26.5, 3.2, .8), (9.0, 2.4, .55),
                          (28.5, 8.5, .6), (2.6, 9.5, .5), (21.0, 1.8, .45)]:
            d.ellipse([sx * K - .55 * K, sy * K - .55 * K, sx * K + .55 * K, sy * K + .55 * K],
                      fill=lerp(SKY, STAR, a))
        for i in range(-4, 5):
            d.line([(16 * K + i * 1.15 * K, HOR), (16 * K + i * 8.2 * K, W)],
                   fill=lerp(GROUND, PINK, .62), width=int(.9 * K))
        for yy, t in [(23.4, .5), (26.2, .38), (30.0, .3)]:
            d.line([(0, yy * K), (W, yy * K)], fill=lerp(GROUND, PINK, t), width=int(.8 * K))
    else:
        # 16 px: the grid turns to noise, so only three fat rails and one rung
        for i in (-2, 0, 2):
            d.line([(16 * K + i * 1.6 * K, HOR), (16 * K + i * 9.0 * K, W)],
                   fill=lerp(GROUND, PINK, .60), width=int(1.6 * K))
        d.line([(0, 26.0 * K), (W, 26.0 * K)], fill=lerp(GROUND, PINK, .42), width=int(1.6 * K))

    d.line([(0, HOR), (W, HOR)], fill=CYAN, width=int((1.6 if detail else 2.2) * K))
    return img.convert('RGBA')

full, small = render(True), render(False)

import io, os, struct
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
i16 = small.resize((16, 16), Image.LANCZOS)
i32 = full.resize((32, 32), Image.LANCZOS)
i48 = full.resize((48, 48), Image.LANCZOS)
full.resize((180, 180), Image.LANCZOS).save(os.path.join(out, 'apple-touch-icon.png'))

# Pillow's ICO writer ignores append_images, so build the container by hand:
# a 16 px entry from the simplified art, 32/48 from the detailed art.
entries = [i16, i32, i48]
blobs = []
for im in entries:
    b = io.BytesIO()
    im.save(b, format='PNG')
    blobs.append(b.getvalue())
offset = 6 + 16 * len(entries)
dirs, data = b'', b''
for im, blob in zip(entries, blobs):
    dirs += struct.pack('<BBBBHHII', im.width, im.height, 0, 0, 1, 32, len(blob), offset)
    offset += len(blob)
    data += blob
with open(os.path.join(out, 'favicon.ico'), 'wb') as f:
    f.write(struct.pack('<HHH', 0, 1, len(entries)) + dirs + data)
print('wrote public/favicon.ico (16/32/48) and public/apple-touch-icon.png (180)')
