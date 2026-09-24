/**
 * Wildwood bosses: MISTRAL (a whirlwind spirit, 40×40), DEEPSEEK (an
 * angler that swims under the floor, 32×28) and GEMINI (masked twins whose
 * half-faces make one face, 24×28 each). Procedural, deterministic, original.
 */
import { type Rows, blank, hash, join, outline } from './spritesWildKit'

const frac = (v: number) => v - Math.floor(v)

// ---------------------------------------------------------------------------
// MISTRAL — pale wind bands spiral round a glowing core with a calm, cold
// face; a funnel of wind runs down to the ground. Four frames turn the bands.
// ---------------------------------------------------------------------------

function mistral(frame: number): Rows {
  const S = 40
  const g = blank(S, S)
  const cx = 20
  const cy = 17
  const turn = frame / 4
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - cx
      const dy = (y + 0.5 - cy) / 0.72
      const r = Math.hypot(dx, dy)
      if (r < 8 || r > 19.5) continue
      const th = Math.atan2(dy, dx) / (Math.PI * 2)
      const band = frac(th * 3 - r / 9 - turn)
      if (band > 0.36) continue
      g[y]![x] = band < 0.07 ? 'w' : band < 0.19 ? 'q' : band < 0.29 ? 'c' : 'C'
    }
  }
  // The funnel: streaks narrowing to a point on the ground.
  for (let y = 29; y < S; y++) {
    const t = (y - 29) / 10
    const half = 9 * (1 - t) + 1.5
    for (let x = 0; x < S; x++) {
      const u = (x + 0.5 - cx) / half
      if (Math.abs(u) > 1) continue
      const s = frac(u * 0.9 + y * 0.22 - turn)
      if (s < 0.45) g[y]![x] = s < 0.12 ? 'w' : s < 0.3 ? 'q' : 'C'
    }
  }
  // The core: a glowing disc with a calm face.
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      if (d <= 7) g[y]![x] = '.'
      if (d <= 6.2) g[y]![x] = d < 3.2 ? 'w' : d < 5 ? 'q' : 'c'
    }
  }
  const rows = outline(join(g))
  const out = rows.map(r => r.split(''))
  // Eyes: level, half-shut lines with a pale pupil under each; a thin mouth.
  for (const ex of [16, 17, 22, 23]) out[16]![ex] = 'C'
  out[17]![16] = 'b'; out[17]![23] = 'b'
  out[15]![15] = 'q'; out[15]![24] = 'q'
  for (const mx of [19, 20]) out[20]![mx] = 'C'
  // A few loose gusts.
  const gusts: Array<[number, number]> = [[3, 6], [36, 10], [2, 26], [37, 24], [8, 1], [31, 2]]
  gusts.forEach(([gx, gy], i) => {
    const ox = (frame + i) % 4 - 1
    const x0 = gx + ox
    if (x0 >= 0 && x0 + 1 < S) { out[gy]![x0] = 'q'; out[gy]![x0 + 1] = i % 2 ? 'w' : 'C' }
  })
  return join(out)
}

// Grounded and dizzy: the bands heaped up, the core dim and exposed.
function mistralDown(): Rows {
  const S = 40
  const g = blank(S, S)
  const cx = 20
  for (let y = 24; y < S - 1; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x + 0.5 - cx) / 18
      const dy = (y + 0.5 - 39) / 12
      if (dx * dx + dy * dy > 1) continue
      const s = frac(y / 3 + Math.sin(x / 3.2) * 0.35 + hash(x, 0, 5) * 0.15)
      g[y]![x] = s < 0.2 ? 'q' : s < 0.45 ? 'C' : s < 0.8 ? 'b' : 'B'
    }
  }
  const ccx = 20
  const ccy = 28
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - ccx, y + 0.5 - ccy)
      if (d <= 6.2) g[y]![x] = d < 3 ? 'q' : d < 5 ? 'c' : 'C'
    }
  }
  const out = outline(join(g)).map(r => r.split(''))
  // Spiral eyes (little 'x's) and a wobbly mouth.
  for (const ex of [17, 23]) {
    out[26]![ex - 1] = 'b'; out[26]![ex + 1] = 'b'; out[27]![ex] = 'b'; out[28]![ex - 1] = 'b'; out[28]![ex + 1] = 'b'
  }
  out[31]![18] = 'b'; out[30]![19] = 'b'; out[31]![20] = 'b'; out[30]![21] = 'b'; out[31]![22] = 'b'
  // Dizzy stars circling above.
  const star = (x: number, y: number) => {
    out[y]![x] = 'w'
    out[y - 1]![x] = 'y'; out[y + 1]![x] = 'y'; out[y]![x - 1] = 'y'; out[y]![x + 1] = 'y'
  }
  star(12, 18); star(28, 17); star(20, 14)
  // A last loose wisp.
  out[36]![1] = 'q'; out[36]![2] = 'C'; out[35]![38] = 'q'
  return join(out)
}

// ---------------------------------------------------------------------------
// DEEPSEEK — a deep-violet angler with a cyan searchlight lure. Surfaced it
// rises out of the floor in a ring of ripples; the fin alone shows while it
// swims beneath.
// ---------------------------------------------------------------------------

function deepseek(frame: number, bite: boolean): Rows {
  const W = 32
  const H = 28
  const g = blank(W, H)
  const cx = 16
  const cy = 17
  const floor = 23
  // Body.
  for (let y = 0; y <= floor; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / 13.5
      const dy = (y + 0.5 - cy) / 10
      if (dx * dx + dy * dy > 1) continue
      const lit = dx * 0.6 + dy
      g[y]![x] = lit < -0.55 ? 'v' : lit < 0.25 ? 'V' : lit < 0.7 ? 'u' : 'K'
    }
  }
  // Side fins and back spines.
  const fin: Array<[number, number]> = [[1, 13], [2, 13], [0, 14], [1, 14], [2, 14], [1, 15], [2, 15], [2, 16]]
  for (const [fx, fy] of fin) { g[fy]![fx] = 'V'; g[fy]![W - 1 - fx] = 'u' }
  for (const sx of [9, 12, 20, 23]) { g[8]![sx] = 'V'; g[7]![sx] = 'v' }
  // Glowing side spots.
  for (const [sx, sy] of [[5, 14], [7, 18], [26, 14], [24, 18], [6, 21], [25, 21]] as Array<[number, number]>) g[sy]![sx] = 'c'
  // Mouth: a wide dark slot, teeth along both lips.
  const mry = bite ? 6 : 3.2
  const mcy = bite ? 17 : 18
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / 10
      const dy = (y + 0.5 - mcy) / mry
      const d = dx * dx + dy * dy
      if (d > 1 || y > floor) continue
      g[y]![x] = d > 0.55 ? 'k' : bite ? (d < 0.2 ? 'k' : 'R') : 'k'
    }
  }
  const top = Math.round(mcy - mry)
  const bot = Math.round(mcy + mry) - 1
  // Fangs of uneven length: long ones every few pixels, stubs between.
  for (let x = 8; x <= 23; x++) {
    const long = x === 9 || x === 14 || x === 18 || x === 22
    if (x % 2 === 0 || long) {
      if (x % 3 !== 1 || long) {
        g[top + 1]![x] = 'w'
        if (long || bite) g[top + 2]![x] = long && !bite ? 'W' : 'w'
        if (long && bite) g[top + 3]![x] = 'W'
      }
    }
    const lower = x === 11 || x === 16 || x === 20 || x === 12
    if (lower && bot <= floor + 1) {
      g[Math.min(bot - 1, floor)]![x] = 'w'
      if (bite) g[bot - 2]![x] = 'W'
    }
  }
  // Eyes: small, high, cold, with a glint.
  for (const [ex, dir] of [[8, 1], [22, -1]] as Array<[number, number]>) {
    g[10]![ex] = 'k'; g[10]![ex + dir] = 'k'
    g[11]![ex] = 'y'; g[11]![ex + dir] = 'w'
    g[12]![ex] = 'Y'; g[12]![ex + dir] = 'y'
  }
  // The lure: a stalk arching from the brow to a searchlight bulb.
  const sway = frame === 1 ? -1 : 1
  const stalk: Array<[number, number]> = [[16, 7], [16, 6], [16 + sway, 5], [16 + sway, 4], [16 + 2 * sway, 3]]
  for (const [sx, sy] of stalk) g[sy]![sx] = 'V'
  const bx = 16 + 3 * sway
  const by = 2
  for (let y = by - 2; y <= by + 2; y++) {
    for (let x = bx - 2; x <= bx + 2; x++) {
      const d = Math.hypot(x - bx, y - by)
      if (y >= 0 && d <= 2.2) g[y]![x] = d < 0.8 ? 'w' : d < 1.6 ? 'c' : 'C'
    }
  }
  const out = outline(join(g)).map(r => r.split(''))
  // Ripples ring the body where it breaks the floor.
  for (let y = floor; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (out[y]![x] !== '.' && y > floor) continue
      const dx = (x + 0.5 - cx) / 15.5
      const dy = (y + 0.5 - (floor + 1)) / 3.4
      const d = Math.hypot(dx, dy)
      if (y > floor && Math.abs(d - 0.95) < 0.09) out[y]![x] = (x + frame) % 3 === 0 ? 'w' : 'c'
      else if (y > floor && Math.abs(d - 0.7) < 0.09 && (x + frame) % 2 === 0) out[y]![x] = 'C'
    }
  }
  // Glow flecks round the bulb.
  if (frame === 0) { out[0]![bx + 3] = 'c'; out[4]![bx - 3] = 'C' } else { out[0]![bx - 3] = 'c'; out[4]![bx + 3] = 'C' }
  return join(out)
}

const deepseekFin: Rows = [
  '.......kk.......',
  '......kvVk......',
  '......kvVk......',
  '.....kvvVVk.....',
  '.....kvVVuk.....',
  '..w.kvvVVuuk.w..',
  '.c.CkkkkkkkkC.c.',
  'C..............C',
]

// ---------------------------------------------------------------------------
// GEMINI — twin floating figures in long robes. Twin A's mask carries the
// left half of a face, twin B's the right half; side by side they make one.
// ---------------------------------------------------------------------------

type Twin = 'a' | 'b'
const TWIN_INK: Record<Twin, { hi: string, mid: string, lo: string, deep: string, glow: string }> = {
  a: { hi: 'c', mid: 'C', lo: 'b', deep: 'B', glow: 'c' },
  b: { hi: 'm', mid: 'p', lo: 'P', deep: 'V', glow: 'm' },
}
const DIM: Record<string, string> = { c: 'C', C: 'b', b: 'B', m: 'p', p: 'P', P: 'V', w: 'W', W: 'g', y: 'Y' }

function gemini(twin: Twin, frame: number): Rows {
  const W = 24
  const H = 28
  const ink = TWIN_INK[twin]
  const g = blank(W, H)
  const cx = 12
  const bob = frame
  const shade = (x: number, half: number) => {
    const t = (x + 0.5 - cx) / Math.max(1, half)
    return t < -0.45 ? ink.hi : t < 0.2 ? ink.mid : t < 0.7 ? ink.lo : ink.deep
  }
  // Robe: a long bell, tattered at the hem (the tatters move per frame).
  for (let y = 8; y <= 24; y++) {
    const half = 4.2 + (y - 8) * 0.36
    for (let x = 0; x < W; x++) {
      if (Math.abs(x + 0.5 - cx) > half) continue
      if (y >= 23 && hash(x, y, 11 + frame) < 0.45) continue
      g[y + bob]![x] = shade(x, half)
    }
  }
  // Bell sleeves.
  for (let y = 12; y <= 18; y++) {
    const reach = 7.5 + (y - 12) * 0.45
    for (let x = 0; x < W; x++) {
      const ax = Math.abs(x + 0.5 - cx)
      if (ax > reach || ax < reach - 2.6) continue
      g[y + bob]![x] = x < cx ? ink.hi : ink.lo
    }
  }
  // Pale hands at the cuffs.
  g[19 + bob]![4] = 'W'; g[19 + bob]![19] = 'g'
  // Hood.
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - 8) * 1.05)
      if (d <= 6.4) g[y + bob]![x] = shade(x, 6)
    }
  }
  // Trim down the front and a gem at the collar.
  for (let y = 15; y <= 24; y++) if (g[y + bob]![11] !== '.') { g[y + bob]![11] = 'y'; g[y + bob]![12] = 'Y' }
  g[14 + bob]![11] = 'w'; g[14 + bob]![12] = ink.glow
  // Face opening and mask.
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / 3.9
      const dy = (y + 0.5 - 9) / 4.4
      const d = dx * dx + dy * dy
      if (d > 1) continue
      const inner = ((x + 0.5 - cx) / 3.1) ** 2 + ((y + 0.5 - 9) / 3.7) ** 2 <= 1
      g[y + bob]![x] = inner ? (x < cx ? 'w' : 'W') : 'k'
    }
  }
  const out = outline(join(g)).map(r => r.split(''))
  const f = (x: number, y: number, ch: string) => { out[y + bob]![x] = ch }
  // The half face: brow, eye with a glowing iris, cheek line, half a mouth.
  const L = twin === 'a'
  const side = (x: number) => (L ? x : 23 - x)
  f(side(9), 7, 'g'); f(side(10), 7, 'g')
  f(side(9), 8, 'k'); f(side(10), 8, ink.glow)
  f(side(10), 10, 'g')
  f(side(10), 11, ink.lo); f(side(11), 11, ink.mid)
  // The blank half: a thin seam down the middle of the mask.
  for (let y = 6; y <= 12; y++) if (out[y + bob]![side(12)] === 'W' || out[y + bob]![side(12)] === 'w') f(side(12), y, 'g')
  // Float glow under the hem.
  const gl = frame === 0 ? [[8, 26], [15, 27], [12, 26]] : [[9, 27], [14, 26], [11, 27]]
  for (const [gx, gy] of gl) if (gy! < H && out[gy!]![gx!] === '.') out[gy!]![gx!] = ink.glow
  return join(out)
}

// Collapsed: the robe a heap, the mask fallen onto it, cracked and dim.
function geminiDown(twin: Twin): Rows {
  const W = 24
  const H = 28
  const ink = TWIN_INK[twin]
  const g = blank(W, H)
  const cx = 12
  for (let y = 17; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / 11.5
      const dy = (y + 0.5 - 28) / 10
      if (dx * dx + dy * dy > 1) continue
      const s = frac(y / 3.2 + Math.sin(x / 2.6) * 0.3)
      g[y]![x] = s < 0.3 ? ink.hi : s < 0.7 ? ink.mid : ink.lo
    }
  }
  const mx = twin === 'a' ? 11 : 12
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = ((x + 0.5 - mx) / 3.6) ** 2 + ((y + 0.5 - 20) / 3.2) ** 2
      if (d <= 1) g[y]![x] = 'W'
    }
  }
  const out = outline(join(g)).map(r => r.split(''))
  const L = twin === 'a'
  const s = (x: number) => (L ? x : 23 - x)
  out[19]![s(9)] = 'k'; out[19]![s(10)] = 'g'
  out[22]![s(10)] = 'g'; out[22]![s(11)] = 'g'
  // The crack: a zigzag across the mask.
  const crack: Array<[number, number]> = [[9, 17], [10, 18], [10, 19], [11, 20], [12, 20], [12, 21], [13, 22]]
  for (const [x, y] of crack) out[y]![s(x)] = 'k'
  const dimmed = join(out).map(r => r.split('').map(ch => DIM[ch] ?? ch).join(''))
  return dimmed
}

export const BOSSES: Record<string, Rows> = {
  mistral_0: mistral(0), mistral_1: mistral(1), mistral_2: mistral(2), mistral_3: mistral(3),
  mistral_down: mistralDown(),
  deepseek_0: deepseek(0, false), deepseek_1: deepseek(1, false), deepseek_bite: deepseek(0, true),
  deepseek_fin: deepseekFin,
  gemini_a_0: gemini('a', 0), gemini_a_1: gemini('a', 1),
  gemini_b_0: gemini('b', 0), gemini_b_1: gemini('b', 1),
  gemini_a_down: geminiDown('a'), gemini_b_down: geminiDown('b'),
}
