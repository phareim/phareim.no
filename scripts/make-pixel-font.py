#!/usr/bin/env python3
"""Draw the 5x7 glyph JSON from make-pixel-font.mjs as a TrueType font (WOFF).

One font pixel = 125 units, em = 8 pixels (7 above the baseline, 1 below),
so at font-size 8n px every pixel is exactly n CSS px. Lower case maps to
the upper-case glyphs, as on the canvas. A glyph with more than seven rows
(Å's ring) reaches into the em's top pixel; the win ascent covers it so it
is not clipped, while the typo metrics (USE_TYPO_METRICS) keep line
heights as before."""
import json, sys
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

src, dst = sys.argv[1], sys.argv[2]
glyphs = json.load(open(src))
U = 125
names, cmap, widths, outlines = ['.notdef'], {}, {'.notdef': 6 * U}, {}

def draw(rows):
    pen = TTGlyphPen(None)
    lift = len(rows) - 7  # rows above the cap height
    for gy, row in enumerate(rows):
        gy -= lift
        x = 0
        while x < len(row):
            if row[x] != '#':
                x += 1; continue
            s = x
            while x < len(row) and row[x] == '#': x += 1
            top = (7 - gy) * U; bot = top - U
            pen.moveTo((s * U, bot)); pen.lineTo((s * U, top)); pen.lineTo((x * U, top)); pen.lineTo((x * U, bot)); pen.closePath()
    return pen.glyph()

outlines['.notdef'] = TTGlyphPen(None).glyph()
for i, (ch, rows) in enumerate(glyphs.items()):
    name = f'g{i}'
    names.append(name)
    outlines[name] = draw(rows)
    widths[name] = (len(rows[0]) + 1) * U
    cmap[ord(ch)] = name
    if ch.isalpha() and ch.lower() != ch:
        cmap[ord(ch.lower())] = name
for alias, to in {'—': '-', '–': '-', '’': "'", '‘': "'", '“': '"', '”': '"', '…': '.', ' ': ' ', '•': '·'}.items():
    if to in glyphs: cmap[ord(alias)] = cmap[ord(to)]

fb = FontBuilder(1000, isTTF=True)
fb.setupGlyphOrder(names)
fb.setupCharacterMap(cmap)
fb.setupGlyf(outlines)
fb.setupHorizontalMetrics({n: (widths[n], 0) for n in names})
fb.setupHorizontalHeader(ascent=875, descent=-125, lineGap=0)
fb.setupNameTable({'familyName': 'Neon Pixel', 'styleName': 'Regular'})
fb.setupOS2(version=4, sTypoAscender=875, sTypoDescender=-125, sTypoLineGap=0, usWinAscent=1000, usWinDescent=125, fsSelection=0x40 | 0x80)
fb.setupPost()
fb.font.flavor = 'woff'
fb.save(dst)
print('wrote', dst, len(names) - 1, 'glyphs')
