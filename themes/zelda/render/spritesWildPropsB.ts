/**
 * More Wildwood set dressing: the abandoned lab van (48×26) and the kids'
 * blanket fort (32×24). Original designs.
 */
import { type Rows, blank, hash, join, outline, stamp } from './spritesWildKit'
import { line } from './spritesWildProps'

// A 3×3 pixel font, just enough to spell the lab's name on the van.
const GLYPH: Record<string, Rows> = {
  H: ['x.x', 'xxx', 'x.x'],
  O: ['xxx', 'x.x', 'xxx'],
  R: ['xx.', 'xxx', 'x.x'],
  I: ['.x.', '.x.', '.x.'],
  Z: ['xx.', '.x.', '.xx'],
  N: ['xxx', 'x.x', 'x.x'],
}

// ---------------------------------------------------------------------------
// Lab van — white, grimy, "HORIZON" over a pink and cyan stripe, the side
// door slid open on a dark load bay, a flat rear tyre.
// ---------------------------------------------------------------------------

const propVan: Rows = (() => {
  const W = 48
  const H = 26
  const g = blank(W, H)
  const right = (y: number) => (y < 10 ? Math.round(39 + (y - 3) * 0.9) : 46)
  for (let y = 3; y <= 19; y++) {
    for (let x = 1; x <= right(y); x++) {
      let ch = y < 7 ? 'w' : y < 15 ? 'W' : 'g'
      if (y >= 15 && hash(x, y, 4) < 0.18) ch = 'G'
      if (y >= 12 && y < 15 && hash(x, y, 9) < 0.08) ch = 'g'
      g[y]![x] = ch
    }
  }
  // Windscreen and cab window.
  for (let y = 4; y <= 8; y++) {
    const r = right(y)
    for (let x = r - 4; x <= r - 1; x++) g[y]![x] = y === 4 || x === r - 4 ? 'b' : 'c'
  }
  g[5]![right(5) - 2] = 'w'; g[6]![right(6) - 3] = 'w'
  for (let y = 5; y <= 8; y++) for (let x = 34; x <= 37; x++) g[y]![x] = y === 5 ? 'B' : 'b'
  g[6]![35] = 'C'
  // Stripe: pink over cyan, full length.
  for (let x = 1; x <= 46; x++) { g[13]![x] = 'p'; g[14]![x] = 'c' }
  // The open side door: a dark bay with a crate, the panel slid back.
  for (let y = 5; y <= 18; y++) {
    for (let x = 29; x <= 33; x++) g[y]![x] = y > 16 ? 'u' : x === 33 ? 'u' : 'K'
  }
  for (let y = 15; y <= 18; y++) for (let x = 30; x <= 32; x++) g[y]![x] = y === 15 ? 'j' : 'n'
  for (let y = 5; y <= 18; y++) { g[y]![21] = 'g'; g[y]![28] = 'g' }
  // Name, in dark blue over the stripe.
  let tx = 3
  for (const ch of 'HORIZON') {
    GLYPH[ch]!.forEach((row, ry) => row.split('').forEach((c, rx) => { if (c === 'x') g[9 + ry]![tx + rx] = 'B' }))
    tx += 4
  }
  // Lights and bumpers.
  g[12]![45] = 'e'; g[12]![46] = 'e'; g[11]![46] = 'w'
  for (const y of [5, 6, 7]) g[y]![1] = 'r'
  for (let y = 16; y <= 19; y++) { g[y]![47] = 'G'; g[y]![0] = 'G' }
  const out = outline(join(g)).map(r => r.split(''))
  // Wheels (the rear tyre is flat), set into dark arches.
  const wheel = (cx: number, flat: boolean) => {
    for (let y = 15; y < H; y++) {
      for (let x = cx - 6; x <= cx + 6; x++) {
        const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - 21.5) * (flat && y > 21 ? 1.5 : 1))
        if (y <= 19 && d <= 5.2 && d > 4.2) out[y]![x] = 'k'
        if (d <= 4.2) out[y]![x] = d > 3 ? 'K' : d > 1.8 ? 'G' : d > 0.9 ? 'g' : 'W'
        if (d > 4.2 && d <= 5 && y > 19) out[y]![x] = 'k'
      }
    }
  }
  wheel(11, true)
  wheel(40, false)
  return join(out)
})()

// ---------------------------------------------------------------------------
// Blanket fort — sheets over a crossbar between two branches, a dark way in
// with a lantern glowing inside, a sagging string of fairy lights.
// ---------------------------------------------------------------------------

const propFort: Rows = (() => {
  const W = 32
  const H = 24
  const g = blank(W, H)
  // Sheets.
  for (let y = 6; y <= 22; y++) {
    const spread = (y - 6) * 0.5
    const l = Math.round(9 - spread)
    const r = Math.round(22 + spread)
    for (let x = l; x <= r; x++) {
      if (y === 22 && hash(x, y, 3) < 0.35) continue
      if (x < 16) g[y]![x] = x === l ? 'P' : (x - l) % 3 === 1 ? 'p' : 'm'
      else g[y]![x] = x === r ? 'B' : (x + y * 2) % 7 === 0 && y % 3 === 0 ? 'W' : 'b'
    }
  }
  // The folds where the sheets hang over the bar.
  for (let x = 8; x <= 23; x++) g[5]![x] = x < 16 ? 'm' : 'b'
  for (let x = 10; x <= 21; x += 3) g[7]![x] = x < 16 ? 'P' : 'B'
  // The way in.
  for (let y = 11; y <= 22; y++) {
    const half = (y - 11) * 0.42
    for (let x = 0; x < W; x++) {
      if (Math.abs(x + 0.5 - 16) > half) continue
      g[y]![x] = y > 18 && Math.abs(x + 0.5 - 16) < 1.5 ? 'o' : y > 18 ? 'a' : 'K'
    }
  }
  g[20]![15] = 'y'; g[20]![16] = 'e'; g[19]![16] = 'y'
  // Branches and the crossbar.
  line(g, 5, 23, 9, 1, 'N')
  line(g, 6, 23, 10, 2, 'n')
  line(g, 26, 23, 22, 0, 'N')
  line(g, 25, 23, 21, 1, 'n')
  line(g, 2, 6, 29, 4, 'n')
  line(g, 9, 3, 7, 0, 'N')
  line(g, 22, 3, 25, 1, 'N')
  const out = outline(join(g)).map(r => r.split(''))
  // Leaves on the twigs.
  stamp(out, ['.f.', 'fLf', '.k.'], 5, 0)
  stamp(out, ['fl.', 'Lf.'], 25, 0)
  // Fairy lights, sagging between the branches.
  const bulbs = ['y', 'p', 'c', 'l']
  let n = 0
  for (let x = 4; x <= 27; x++) {
    const t = (x - 15.5) / 11.5
    const y = Math.round(6 + 4 * (1 - t * t))
    out[y]![x] = x % 3 === 1 ? bulbs[n++ % 4]! : 'u'
  }
  return join(out)
})()

export const PROPS_B: Record<string, Rows> = {
  prop_van: propVan,
  prop_fort: propFort,
}
