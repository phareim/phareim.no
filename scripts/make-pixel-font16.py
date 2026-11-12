#!/usr/bin/env python3
"""Draw the glyph JSON from make-pixel-font16.mjs as a TrueType font (WOFF2).

One font pixel = 64 units, em = 16 pixels (1024 units): 14 above the baseline
and 2 below, so the twelve-row capitals sit in the middle of the em, as they
sit in the canvas HUD's fourteen-pixel line. At font-size 16n px every font
pixel is exactly n CSS px. The advance is the glyph's width + 2 pixels, as on
the canvas. Lower case maps to the upper-case glyphs. Rows over the capitals
(Å's ring) reach past the typo ascender; the win ascent covers them so they
are not clipped, while the typo metrics (USE_TYPO_METRICS) keep the line at
one em."""
import json, sys
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

src, dst = sys.argv[1], sys.argv[2]
glyphs = json.load(open(src))
U = 64
CAP = 12
GAP = 2
names, cmap, widths, outlines = ['.notdef'], {}, {'.notdef': 8 * U}, {}

def runs(row):
    """The lit stretches of a row as (start, end) pairs."""
    out, x = [], 0
    while x < len(row):
        if row[x] != '#':
            x += 1; continue
        s = x
        while x < len(row) and row[x] == '#': x += 1
        out.append((s, x))
    return out

def draw(g):
    """One rectangle per lit stretch; a stretch that repeats on the rows below is one tall rectangle (fewer points, a smaller file)."""
    rows = g['above'] + g['rows'] + g['below']
    lift = len(g['above'])
    spans = [runs(r) for r in rows]
    pen = TTGlyphPen(None)
    for y, row in enumerate(spans):
        for run in row:
            if y > 0 and run in spans[y - 1]:
                continue  # already inside the rectangle that began above
            end = y + 1
            while end < len(spans) and run in spans[end]: end += 1
            top = (CAP - (y - lift)) * U
            bot = (CAP - (end - lift)) * U
            s, e = run[0] * U, run[1] * U
            pen.moveTo((s, bot)); pen.lineTo((s, top)); pen.lineTo((e, top)); pen.lineTo((e, bot)); pen.closePath()
    return pen.glyph()

outlines['.notdef'] = TTGlyphPen(None).glyph()
for i, (ch, g) in enumerate(glyphs.items()):
    name = f'g{i}'
    names.append(name)
    outlines[name] = draw(g)
    widths[name] = (len(g['rows'][0]) + GAP) * U
    cmap[ord(ch)] = name
    if ch.isalpha() and ch.lower() != ch:
        cmap[ord(ch.lower())] = name
# What font16.ts's ALIAS draws an unknown character as (É, — and … have glyphs of their own here), and two the pages use.
for alias, to in {'’': "'", '‘': "'", '“': '"', '”': '"', 'È': 'E', 'Ä': 'Æ', 'Ö': 'Ø', 'Ü': 'U', ' ': ' ', '•': '·'}.items():
    if to in glyphs:
        cmap[ord(alias)] = cmap[ord(to)]
        if alias.isalpha() and alias.lower() != alias: cmap[ord(alias.lower())] = cmap[ord(to)]

fb = FontBuilder(16 * U, isTTF=True)
fb.setupGlyphOrder(names)
fb.setupCharacterMap(cmap)
fb.setupGlyf(outlines)
fb.setupHorizontalMetrics({n: (widths[n], 0) for n in names})
fb.setupHorizontalHeader(ascent=14 * U, descent=-2 * U, lineGap=0)
fb.setupNameTable({'familyName': 'Neon Pixel 16', 'styleName': 'Regular'})
fb.setupOS2(version=4, sTypoAscender=14 * U, sTypoDescender=-2 * U, sTypoLineGap=0, usWinAscent=16 * U, usWinDescent=3 * U, sCapHeight=CAP * U, sxHeight=CAP * U, fsSelection=0x40 | 0x80)
fb.setupPost()
fb.font.flavor = 'woff2'
fb.save(dst)
print('wrote', dst, len(names) - 1, 'glyphs')
