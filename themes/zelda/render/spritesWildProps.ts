/**
 * Wildwood set dressing, drawn bottom-centred on the given spot: the camp
 * (tent, fire, BMX), the radio mast, the lab's specimen tanks and van, and
 * the kids' blanket fort. Procedural where shapes repeat; original designs.
 */
import { type Rows, blank, hash, join, outline, stamp } from './spritesWildKit'

type Grid = string[][]

function line(g: Grid, x0: number, y0: number, x1: number, y1: number, ch: string | ((i: number) => string)): void {
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  let x = x0
  let y = y0
  let i = 0
  for (;;) {
    if (y >= 0 && y < g.length && x >= 0 && x < g[0]!.length) g[y]![x] = typeof ch === 'string' ? ch : ch(i)
    if (x === x1 && y === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x += sx }
    if (e2 <= dx) { err += dx; y += sy }
    i++
  }
}

// ---------------------------------------------------------------------------
// Dome tent (32×24), lit warm on the right by the campfire.
// ---------------------------------------------------------------------------

const propTent: Rows = (() => {
  const W = 32
  const H = 24
  const g = blank(W, H)
  const cx = 16
  const base = 22.5
  const rx = 14.5
  const ry = 19
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / rx
      const dy = (y + 0.5 - base) / ry
      if (dy > 0 || dx * dx + dy * dy > 1) continue
      const t = dx
      let ch = t < -0.4 ? 'B' : t < 0.3 ? 'b' : t < 0.8 ? 'v' : 'o'
      // Seams: the poles cross over the dome.
      const w = Math.sqrt(Math.max(0, 1 - dy * dy))
      if (Math.abs(Math.abs(dx) - 0.5 * w) < 0.05) ch = t > 0.2 ? 'V' : 'B'
      if (Math.abs(dx) < 0.035) ch = t > 0 ? 'V' : 'B'
      // Rim light on the fire side.
      if (t > 0.4 && dx * dx + dy * dy > 0.86) ch = t > 0.75 ? 'y' : 'o'
      g[y]![x] = ch
    }
  }
  // The door: a dark arch with the flap rolled up at its edge.
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / 5
      const dy = (y + 0.5 - base) / 11
      if (dy > 0 || dx * dx + dy * dy > 1) continue
      g[y]![x] = dx * dx + dy * dy > 0.7 ? 'y' : x > cx + 1 ? 'a' : 'K'
    }
  }
  for (let y = 13; y <= 22; y++) g[y]![11] = 'W'
  // Ground shadow and guy ropes.
  for (let x = 2; x < 30; x++) if (g[22]![x] === '.') g[22]![x] = 'u'
  const out = outline(join(g)).map(r => r.split(''))
  line(out, 3, 14, 0, 22, 'g')
  line(out, 28, 14, 31, 22, 'y')
  for (let x = 1; x < 31; x++) if (out[23]![x] === '.') out[23]![x] = hash(x, 23, 2) < 0.5 ? 'u' : '.'
  return join(out)
})()

// ---------------------------------------------------------------------------
// Campfire (16×16, three frames): stones in a ring, crossed logs, flames.
// ---------------------------------------------------------------------------

const FLAMES: Rows[] = [
  [
    '.......r........',
    '......rr....r...',
    '......ror..rr...',
    '.....roor.ror...',
    '....rooyorooor..',
    '....royyyoyyor..',
    '...roywwyyyyor..',
    '...royywwwyyor..',
    '....roywwwyor...',
    '.....ooyyyoo....',
  ],
  [
    '........r.......',
    '...r...ror......',
    '...rr..roor.....',
    '...ror.royor....',
    '...roorryyor....',
    '...royyoyyoor...',
    '..roywwyyywor...',
    '..royywwwyyor...',
    '...roywwwyyor...',
    '....ooyyyyoo....',
  ],
  [
    '.........r......',
    '.....r..rr......',
    '....ror.ror.....',
    '....rorroor..r..',
    '...royyooyor.r..',
    '...royyyyyoror..',
    '...roywwyyyyor..',
    '..roywwwwyyyor..',
    '...roywwwwyor...',
    '....ooyyyyyo....',
  ],
]

function campfire(frame: number): Rows {
  const g = blank(16, 16)
  // Logs, crossed.
  const logs = blank(16, 16)
  line(logs, 3, 13, 11, 10, 'n')
  line(logs, 4, 13, 12, 10, 'N')
  line(logs, 12, 13, 4, 10, 'n')
  line(logs, 11, 13, 3, 10, 'N')
  const logRows = outline(join(logs))
  stamp(g, logRows, 0, 0)
  // Flames over the logs.
  stamp(g, FLAMES[frame]!, 0, 1)
  // Stone ring, the front stones drawn over everything.
  const stones: Array<[number, number]> = [[1, 12], [3, 14], [6, 15], [10, 15], [13, 14], [14, 12], [2, 11], [13, 11]]
  stones.forEach(([sx, sy], i) => {
    const pal = i % 3 === 0 ? ['W', 'g'] : i % 3 === 1 ? ['g', 'G'] : ['g', 'u']
    const st: Rows = ['.kkk.', 'k' + pal[0] + pal[0] + pal[1] + 'k', 'k' + pal[1] + pal[1] + 'Gk', '.kkk.']
    stamp(g, st, sx - 2, sy - 3)
  })
  // Embers.
  const embers = [[[2, 3], [13, 5]], [[12, 2], [3, 6]], [[4, 2], [11, 4]]][frame]!
  for (const [ex, ey] of embers) g[ey!]![ex!] = 'y'
  return join(g)
}

// ---------------------------------------------------------------------------
// Kid's BMX (16×12), side on, facing right.
// ---------------------------------------------------------------------------

const propBike: Rows = (() => {
  const g = blank(16, 12)
  for (const [wx, wy] of [[3.5, 8.5], [12.5, 8.5]] as Array<[number, number]>) {
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x + 0.5 - wx, y + 0.5 - wy)
        if (d <= 3.4 && d > 2.4) g[y]![x] = 'k'
        else if (d <= 2.4 && d > 1.6) g[y]![x] = 'g'
        else if (d <= 0.8) g[y]![x] = 'W'
      }
    }
  }
  // Frame: pink tubes from the rear hub to the seat, crank and head tube.
  line(g, 4, 8, 6, 4, 'p')
  line(g, 4, 8, 8, 8, 'p')
  line(g, 6, 4, 8, 8, 'P')
  line(g, 6, 4, 11, 4, 'p')
  line(g, 8, 8, 11, 4, 'p')
  line(g, 11, 4, 12, 8, 'm')
  // Seat, bars, grip, crank.
  g[3]![5] = 'k'; g[3]![6] = 'k'; g[3]![7] = 'k'
  g[3]![11] = 'g'; g[2]![11] = 'g'; g[2]![12] = 'k'; g[1]![10] = 'g'; g[1]![11] = 'k'
  g[9]![8] = 'y'; g[9]![9] = 'k'
  return join(g)
})()

// ---------------------------------------------------------------------------
// Radio mast (24×56): a red-and-white lattice tower on a concrete foot, a
// dish half-way up, and a warning light on top (`prop_mast_on` lit).
// ---------------------------------------------------------------------------

function mast(on: boolean): Rows {
  const W = 24
  const H = 56
  const g = blank(W, H)
  const topY = 6
  const botY = 51
  const legX = (y: number, left: boolean) => {
    const t = (y - topY) / (botY - topY)
    return Math.round(left ? 10 - t * 7 : 13 + t * 7)
  }
  const band = (y: number) => (Math.floor((y - topY) / 7) % 2 === 0 ? 'r' : 'W')
  // Cross bracing first so the legs sit on top.
  for (let y = topY; y < botY - 4; y += 5) {
    const y2 = y + 5
    line(g, legX(y, true), y, legX(y2, false), y2, 'G')
    line(g, legX(y, false), y, legX(y2, true), y2, 'g')
  }
  for (let y = topY; y <= botY; y++) {
    g[y]![legX(y, true)] = band(y)
    g[y]![legX(y, false)] = band(y)
  }
  // Spike.
  for (let y = 2; y < topY; y++) { g[y]![11] = 'W'; g[y]![12] = 'g' }
  // The dish.
  const dish: Rows = ['.kk.', 'kWWk', 'kWgk', 'kggk', '.kk.']
  const out = outline(join(g)).map(r => r.split(''))
  stamp(out, dish, 15, 20)
  out[22]![14] = 'g'
  // Concrete foot.
  const foot: Rows = [
    '..kkkkkkkkkkkkkkkkkkkk..',
    '.kWggggggggggggggggggGk.',
    '.kgGGGGGGGGGGGGGGGGGGGk.',
    '.kGuuuuuuuuuuuuuuuuuuuk.',
    '..kkkkkkkkkkkkkkkkkkkk..',
  ]
  stamp(out, foot, 0, 51)
  // Warning light.
  const lamp: Rows = on ? ['.kk.', 'krwk', 'krrk', '.kk.'] : ['.kk.', 'kRrk', 'kRRk', '.kk.']
  stamp(out, lamp, 10, 0)
  if (on) {
    for (const [x, y] of [[9, 0], [14, 0], [8, 2], [15, 2], [9, 4], [14, 4]] as Array<[number, number]>) out[y]![x] = y === 2 ? 'r' : 'p'
  }
  return join(out)
}

// ---------------------------------------------------------------------------
// Specimen tank (16×28): a glass cylinder of teal liquid on a lit base.
// Something dim curls inside; the bubbles rise between frames.
// ---------------------------------------------------------------------------

function tank(frame: number): Rows {
  const top: Rows = [
    '...kkkkkkkkkk...',
    '..kWggggggggGk..',
    '..kgGGGGGGGGGk..',
    '.kkkkkkkkkkkkkk.',
  ]
  const glass = (y: number): string => {
    if (y === 4) return '.kqcccccccccCk..'.slice(0, 16)
    return '.kqttttttttttTk.'
  }
  const rows: Rows = [...top]
  for (let y = 4; y <= 22; y++) rows.push(y === 4 ? '.kqccccccccccCk.' : glass(y))
  rows.push(
    '.kkkkkkkkkkkkkk.',
    '.kWggggggggggGk.',
    '.kgGlGGrGGlGGGk.',
    '.kGGGGGGGGGGGGk.',
    '..kkkkkkkkkkkk..',
  )
  const g = rows.map(r => r.split(''))
  // Glass sheen, a vertical streak on the left.
  for (let y = 5; y <= 21; y++) g[y]![3] = y % 6 === 0 ? 'w' : 'q'
  // The dim thing inside.
  const thing: Rows = ['..TT..', '.TTTT.', 'TT.TT.', '.TTTT.', '..TTT.', '...TT.', '..TT..']
  stamp(g, thing, 6, 10 + frame)
  // Bubbles.
  const bub = frame === 0 ? [[5, 18], [11, 13], [9, 7], [6, 9]] : [[5, 15], [11, 10], [8, 19], [10, 6]]
  for (const [bx, by] of bub) g[by!]![bx!] = 'w'
  g[bub[1]![1]! + 1]![bub[1]![0]!] = 'q'
  return join(g)
}

export { line }

export const PROPS_A: Record<string, Rows> = {
  prop_tent: propTent,
  prop_campfire_0: campfire(0), prop_campfire_1: campfire(1), prop_campfire_2: campfire(2),
  prop_bike: propBike,
  prop_mast: mast(false), prop_mast_on: mast(true),
  prop_tank_0: tank(0), prop_tank_1: tank(1),
}
