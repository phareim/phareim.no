"""Pixel favicon and app icons for phareim.no (2026-09-25): the pixel look's
dusk (themes/base/pixel/scenery.ts) on a tiny grid — a dithered sky, the
striped sun, a violet ridge with a magenta rim, teal grass and the rose path
into town. Each icon is drawn on its own grid of N logical pixels and scaled
up by a whole number with nearest-neighbour, so every pixel stays square."""
import io
import os
import struct

from PIL import Image

HEX = {
    'sky0': '0b0616', 'sky1': '140b26', 'sky2': '1c1030', 'sky3': '2a1a4c', 'sky4': '43246e', 'sky5': '6a2a7c', 'sky6': 'a8347e',
    'star': 'cfc6ff', 'sun0': 'fff1b0', 'sun1': 'ffd23f', 'sun2': 'ff8a3d', 'sun3': 'ff2fa0',
    'ridge': '2c2058', 'rim': 'd0509e', 'g0': '245573', 'g2': '1b4560', 'tip': '6fd2d6',
    'path': '7d4d7c', 'pathL': '9b6593',
}
C = {k: tuple(int(v[i:i + 2], 16) for i in (0, 2, 4)) + (255,) for k, v in HEX.items()}
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def draw(n: int) -> Image.Image:
    img = Image.new('RGBA', (n, n), C['sky0'])
    px = img.load()
    horizon = round(n * 0.62)

    # Sky: bands top to horizon, each dithered into the next.
    stops = ['sky1', 'sky2', 'sky3', 'sky4', 'sky5', 'sky6']
    for y in range(horizon):
        t = y / horizon * (len(stops) - 1)
        i = min(int(t), len(stops) - 2)
        f = t - i
        for x in range(n):
            px[x, y] = C[stops[i + 1] if f * 16 > BAYER[y % 4][x % 4] + 0.5 else stops[i]]
    if n >= 24:
        for sx, sy in ((0.14, 0.12), (0.8, 0.08), (0.9, 0.3), (0.3, 0.26)):
            px[int(sx * n), int(sy * n)] = C['star']

    # The striped sun, sitting on the horizon.
    r = n * 0.34
    cx, cy = (n - 1) / 2, horizon - 0.5
    period = max(2, round(r / 3))
    for y in range(horizon):
        dy = y + 0.5 - cy
        if dy * dy > r * r:
            continue
        t = (dy + r) / (2 * r)
        below = y - (cy - r * 0.45)
        if below > 0 and below % period < 1 + below / r * (period - 1) * 0.9:
            continue  # a dark band: the sky shows through
        col = C['sun0'] if t < 0.2 else C['sun1'] if t < 0.34 else C['sun2'] if t < 0.44 else C['sun3']
        for x in range(n):
            dx = x + 0.5 - (cx + 0.5)
            if dx * dx + dy * dy <= r * r:
                px[x, y] = col

    # Ridge: two humps at the sides, dipping behind the sun's foot.
    for x in range(n):
        u = x / (n - 1)
        h = max(0.0, 0.2 - 2.4 * (u - 0.1) ** 2, 0.17 - 2.6 * (u - 0.92) ** 2) * n
        top = horizon - round(h)
        for y in range(top, horizon + 1):
            px[x, y] = C['ridge']
        if h > 0.5:
            px[x, top] = C['rim']

    # Grass, then the path from the bottom edge up to the horizon.
    for y in range(horizon + 1, n):
        for x in range(n):
            px[x, y] = C['g2'] if (x * 7 + y * 13 + x * y) % 11 < 2 else C['g0']
    for x in range(n):
        px[x, horizon] = C['tip']
    for y in range(horizon + 1, n):
        t = (y - horizon) / (n - horizon)
        half = 0.5 + t * n * 0.22
        for x in range(n):
            if abs(x + 0.5 - n / 2) <= half:
                px[x, y] = C['pathL'] if (x + y) % 4 == 0 and n >= 24 else C['path']
    return img


def icon(size: int, grid: int) -> Image.Image:
    assert size % grid == 0, (size, grid)
    return draw(grid).resize((size, size), Image.NEAREST)


out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
icon(180, 36).save(os.path.join(out, 'apple-touch-icon.png'))
# The web app manifest's icons (Android wants 192 and 512 to offer an install).
# The art fills the square, so the same files double as maskable icons.
icon(192, 32).save(os.path.join(out, 'icon-192.png'))
icon(512, 32).save(os.path.join(out, 'icon-512.png'))

# Pillow's ICO writer ignores append_images, so build the container by hand.
entries = [icon(16, 16), icon(32, 16), icon(48, 16)]
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
print('wrote public/favicon.ico (16/32/48), apple-touch-icon.png (180), icon-192.png and icon-512.png')
