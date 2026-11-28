/**
 * THE BALANCE's drawing (`engine/balance.ts`), shared by both painters: on the floor the seven brass pans and, once
 * level, the open floor; in the pans the Weights; over everything the beam on the north wall, the counter and the
 * pans' labels; and on the HUD the counter again, for a phone that sees only part of the room. Also the one thing
 * the Dark Store asks of the top-down painters: THE LENS's hidden chest and its ring (`engine/lens.ts`). And what the
 * Supply Room adds to THE PAPERCLIP MAXIMIZER (`engine/bossMaximizer.ts`): which frame it shows, the stations, the
 * tiles that flash before they are piles, the arrow to a station past the screen's edge, and the calls into the seven
 * tricks' pictures (`maximizerTricks.ts`). The discs, their ring and column and the arrow are code STAND-INS.
 */
import type { Enemy, GameState, World, WeightId } from '../types'
import { HERO_R, TILE, WEIGHTS } from '../types'
import { LEVEL_FLAG, PANS, panFlag, pansHeld } from '../engine/balance'
import { MAXI, maximizerFlash, stationOf, type Station } from '../engine/bossMaximizer'
import { drawTrickFloor, drawTrickOver, queueTrick, trickFrame } from './maximizerTricks'
import { has, mapInfo } from '../engine/map'
import { LENS, glassThings } from '../engine/lens'
import { drawText, textWidth } from '../../base/pixel/font'
import { sprite } from './sheet'
import type { Light } from './tiles'
import type { HudSkin } from './hud'
import type { SceneItem } from './renderer'

type G = CanvasRenderingContext2D
/** A point of the world (tiles, `z` up) as the view in force places it. */
type Place = (x: number, y: number, z?: number) => { x: number; y: number }
const T = TILE

const INK = '#0b0616'
const BRASS = '#d9a53a'
const BRASS_LIGHT = '#ffe08a'
const BRASS_DARK = '#7a5416'
const DISH = '#a87a24'
const GOLD = '#ffd23f'
const PALE = '#fff4ff'
const LILAC = '#c7b3f6'
const GREY = '#6c6288'

const here = (s: GameState) => s.map.id === 'balance'
const held = (s: GameState, id: WeightId) => has(s, panFlag(WEIGHTS.find(w => w.id === id)!.word))
const iconName = (id: WeightId) => `item_weight_${WEIGHTS.find(w => w.id === id)!.word.toLowerCase()}`

/** An ellipse in whole px, half widths (rx, ry) round (mx, my). */
function oval(g: G, mx: number, my: number, rx: number, ry: number, color: string) {
  g.fillStyle = color
  for (let row = -ry; row <= ry; row++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (row / (ry + 0.4)) ** 2)))
    g.fillRect(mx - w, my + row, w * 2 + 1, 1)
  }
}

// ---------------------------------------------------------------------------
// On the floor
// ---------------------------------------------------------------------------

/** A shallow brass dish, wider than its Weight: level and light while empty, sunk into its shadow with the Weight on it. */
function pan(g: G, mx: number, my: number, sunk: boolean) {
  oval(g, mx, my + 2, 11, 8, 'rgba(4,2,10,0.55)')
  const y = my + (sunk ? 2 : 0)
  oval(g, mx, y, 10, 7, INK)
  oval(g, mx, y, 9, 6, BRASS_DARK)
  oval(g, mx, y - (sunk ? 0 : 1), 9, 6, sunk ? BRASS : BRASS_LIGHT)
  oval(g, mx, y, 7, 4, sunk ? BRASS_DARK : DISH)
  if (!sunk) { g.fillStyle = BRASS_LIGHT; g.fillRect(mx - 3, y + 2, 7, 1) }
}

/** The floor come open: a dark square over its four tiles, steps going down into it. */
function hole(g: G, x: number, y: number, time: number, reduced: boolean) {
  const w = T * 2
  g.fillStyle = BRASS
  g.fillRect(x - 1, y - 1, w + 2, w + 2)
  g.fillStyle = INK
  g.fillRect(x + 1, y + 1, w - 2, w - 2)
  // Five treads, each darker and narrower than the one above it.
  const tones = ['#8f80c8', '#6a5ca6', '#4b3f82', '#32295e', '#1d1740']
  tones.forEach((c, i) => {
    g.fillStyle = c
    g.fillRect(x + 3 + i * 2, y + 4 + i * 5, w - 6 - i * 4, 3)
  })
  g.globalAlpha = reduced ? 0.5 : 0.4 + 0.25 * Math.sin(time * 3)
  g.fillStyle = GOLD
  g.fillRect(x + 1, y + w - 2, w - 2, 1)
  g.globalAlpha = 1
}

/** The glass's ring round a still hero's feet, from above (the side painter draws its own). */
function ring(g: G, world: World, s: GameState, cx: number, cy: number, reduced: boolean) {
  const l = s.lens
  if (!l || !l.here || l.still < LENS.ring || mapInfo(world, s.map.id).def.kind === 'side') return
  const gone = l.up ? l.k : 0
  if (gone >= 1) return
  const p = Math.min(1, (l.still - LENS.ring) / (LENS.up - LENS.ring))
  const x = Math.round(s.hero.x * T - cx)
  const y = Math.round((s.hero.y + HERO_R) * T - cy)
  const rx = Math.round(T * 0.75 * (reduced ? 1 : 0.45 + 0.55 * p))
  const ry = Math.max(3, Math.round(rx * 0.7))
  g.globalAlpha = (0.55 + 0.45 * p) * (1 - gone)
  g.fillStyle = '#bfefff'
  const steps = Math.round(rx * 7)
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2
    g.fillRect(Math.round(x + Math.cos(a) * rx - 1), Math.round(y + Math.sin(a) * ry - 1), 2, 2)
  }
  g.globalAlpha = 1
}

/**
 * A frame round each of the Counting Room's plates, which are faint on this floor: brass for the two that open the
 * way on, lilac for the three of the closet, cyan once held. It lies at the tile's edge, so a crate shows it too.
 */
function plateFrames(g: G, world: World, s: GameState, cx: number, cy: number) {
  if (s.map.id !== 'supply') return
  for (const [i, id] of mapInfo(world, s.map.id).plates) {
    const x = (i % s.map.w) * T - cx
    const y = Math.floor(i / s.map.w) * T - cy
    g.fillStyle = s.map.plates.includes(id) ? '#2ff3ff' : id.startsWith('h') ? '#9d7fe8' : BRASS
    // Corners only: a mark on the floor, not a wall of colour.
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      g.fillRect(x + dx * 11, y + dy * 15, 5, 1)
      g.fillRect(x + dx * 15, y + dy * 11, 1, 5)
    }
  }
}

export function drawBalanceFloor(g: G, world: World, s: GameState, cx: number, cy: number, time: number, reduced: boolean) {
  ring(g, world, s, cx, cy, reduced)
  plateFrames(g, world, s, cx, cy)
  if (!here(s)) return
  const info = mapInfo(world, s.map.id)
  // The open floor: the waiting warps' tiles, once their stairs have appeared.
  const open = info.warps.filter(w => w.when && s.map.tiles[w.y * s.map.w + w.x] === '>')
  if (open.length) hole(g, Math.min(...open.map(w => w.x)) * T - cx, Math.min(...open.map(w => w.y)) * T - cy, time, reduced)
  for (const p of PANS) pan(g, Math.round((p.x + 0.5) * T - cx), Math.round((p.y + 0.5) * T - cy), held(s, p.weight))
}

// ---------------------------------------------------------------------------
// Standing in the world
// ---------------------------------------------------------------------------

/** The Weights in their pans, and (on any top-down map) the chests only the glass shows. */
export function queueBalance(g: G, world: World, s: GameState, cx: number, cy: number, items: SceneItem[], lights: Light[], time: number) {
  queueStation(g, s, cx, cy, items, lights, time)
  if (here(s)) {
    for (const p of PANS) {
      if (!held(s, p.weight)) continue
      items.push({
        x: p.x + 0.5, foot: 5 / T, y: p.y + 0.45,
        draw: () => {
          const spr = sprite(iconName(p.weight))
          g.drawImage(spr, Math.round((p.x + 0.5) * T - cx - spr.width / 2), Math.round((p.y + 0.5) * T - cy + 6 - spr.height))
        },
      })
      lights.push({ x: p.x + 0.5, y: p.y + 0.4, r: 1.3, color: GOLD, a: 0.55 })
    }
  }
  const info = mapInfo(world, s.map.id)
  if (info.def.kind === 'side') return
  for (const t of glassThings(info)) {
    if (t.is !== 'cache') continue
    if (t.cell !== s.zoneIndex && !(s.scroll && t.cell === s.scroll.index)) continue
    // Opened, it is a chest like any other; unopened, as solid to the eye as the glass is up, faint once shown.
    const opened = has(s, `chest:${t.id}`)
    const a = opened ? 1 : Math.max(t.cell === s.zoneIndex ? s.lens?.k ?? 0 : 0, s.map.lensSeen?.includes(t.i) ? LENS.pencil : 0)
    if (a <= 0.004) continue
    items.push({
      x: t.x + 0.5, foot: 6 / T, y: t.y + 0.62,
      draw: () => {
        const spr = sprite(opened ? 'chest_open' : 'chest')
        const px = Math.round((t.x + 0.5) * T - cx)
        const py = (t.y + 1) * T - cy
        const was = g.globalAlpha
        g.globalAlpha = was * a
        g.fillStyle = 'rgba(0,0,0,0.35)'
        g.fillRect(px - spr.width / 2 + 1, py - 3, spr.width - 2, 3)
        g.drawImage(spr, Math.round(px - spr.width / 2), py - spr.height)
        // A pale rim of the glass's light while it is up.
        if (!opened && a > 0.5) { g.fillStyle = '#bfefff'; g.fillRect(px - 8, py - 1, 16, 1) }
        g.globalAlpha = was
      },
    })
    if (a > 0.5) lights.push({ x: t.x + 0.5, y: t.y + 0.5, r: 1.8, color: opened ? GOLD : '#2ff3ff', a: 0.8 * a })
  }
}

// ---------------------------------------------------------------------------
// Over the world: the beam, the counter, the labels
// ---------------------------------------------------------------------------

/** A thick stroke in whole px. */
function stroke(g: G, a: { x: number; y: number }, b: { x: number; y: number }, size: number, color: string) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))))
  g.fillStyle = color
  for (let i = 0; i <= n; i++) g.fillRect(Math.round(a.x + ((b.x - a.x) * i) / n - size / 2), Math.round(a.y + ((b.y - a.y) * i) / n - size / 2), size, size)
}

/** The brass beam along the north wall's face, tilted until the balance is level, a short chain and weight at each end. */
function beam(g: G, s: GameState, place: Place) {
  const level = has(s, LEVEL_FLAG)
  const lean = level ? 0 : 0.3
  const left = place(2.4, 1, 0.45 - lean)
  const right = place(14.6, 1, 0.45 + lean)
  stroke(g, left, right, 5, INK)
  stroke(g, left, right, 3, BRASS)
  stroke(g, { x: left.x, y: left.y - 1 }, { x: right.x, y: right.y - 1 }, 1, BRASS_LIGHT)
  for (const end of [left, right]) {
    stroke(g, end, { x: end.x, y: end.y + 5 }, 1, BRASS_LIGHT)
    g.fillStyle = INK
    g.fillRect(Math.round(end.x) - 4, Math.round(end.y) + 5, 9, 4)
    g.fillStyle = level ? GOLD : DISH
    g.fillRect(Math.round(end.x) - 3, Math.round(end.y) + 6, 7, 2)
  }
}

/** "N/7" in digits twice the size of the lettering, on a dark plate with its middle at (mx, my). */
function digits(g: G, mx: number, my: number, n: number, level: boolean) {
  const text = `${n}/${WEIGHTS.length}`
  const w = textWidth(text) * 2
  const x = Math.round(mx - w / 2)
  const y = Math.round(my - 7)
  g.fillStyle = INK
  g.fillRect(x - 4, y - 1, w + 8, 16)
  g.fillStyle = level ? GOLD : BRASS_DARK
  g.fillRect(x - 4, y - 1, w + 8, 1)
  g.fillRect(x - 4, y + 14, w + 8, 1)
  g.save()
  g.translate(x, y)
  g.scale(2, 2)
  drawText(g, text, 0, 0, level ? GOLD : PALE, BRASS_DARK)
  g.restore()
}

/**
 * The beam, the counter and the labels, placed by the view in force (`place`) and drawn upright. From above the
 * labels are kept inside the room's 16 tiles. A label the hero stands behind thins out.
 */
export function drawBalanceOver(g: G, s: GameState, place: Place, flat: boolean) {
  drawTrickOver(g, s, place)
  behindMark(g, s, place, flat)
  stationMark(g, s, place)
  if (!here(s)) return
  beam(g, s, place)
  const mid = place(8.5, 1, 0.6)
  digits(g, mid.x, mid.y, pansHeld(s.flags), has(s, LEVEL_FLAG))
  const west = place(0, 0).x
  const hero = place(s.hero.x, s.hero.y)
  for (const p of PANS) {
    const word = WEIGHTS.find(w => w.id === p.weight)!.word
    const at = place(p.x + 0.5, p.y + 1)
    const wide = Math.max(textWidth(word), textWidth(p.by))
    // (From above: 2 px in from the room's sides.)
    const centre = (w: number) => {
      const x = Math.round(at.x - w / 2)
      return flat ? Math.round(Math.max(west + 2, Math.min(west + 16 * T - 2 - w, x))) : x
    }
    const y = Math.round(at.y) + 1
    const behind = Math.abs(hero.x - at.x) < wide / 2 + 5 && hero.y > at.y - 2 && hero.y < at.y + 26
    const was = g.globalAlpha
    g.globalAlpha = was * (behind ? 0.3 : 1)
    const taken = held(s, p.weight)
    drawText(g, word, centre(textWidth(word)), y, taken ? GOLD : PALE, INK)
    drawText(g, p.by, centre(textWidth(p.by)), y + 9, taken ? GREY : LILAC, INK)
    g.globalAlpha = was
  }
}

// ---------------------------------------------------------------------------
// On the HUD
// ---------------------------------------------------------------------------

/** The counter under the hearts and counters, both views, while the hero is in the Balance. */
export function drawBalanceHud(g: G, s: GameState, skin: HudSkin) {
  if (!here(s) || !s.inv.sword) return
  const hearts = Math.ceil(s.hero.maxHp / 2)
  const y = 4 + Math.ceil(hearts / 10) * (skin.heartStep ?? 9) + 13 + Math.round(7 * ((skin.heartScale ?? 1) - 1))
  const text = `WEIGHTS ${pansHeld(s.flags)}/${WEIGHTS.length}`
  g.fillStyle = 'rgba(11,6,22,0.75)'
  g.fillRect(3, y - 2, textWidth(text) + 6, 11)
  drawText(g, text, 6, y, has(s, LEVEL_FLAG) ? skin.prize : skin.text, skin.outline)
}

// ---------------------------------------------------------------------------
// The Supply Room: THE PAPERCLIP MAXIMIZER's pictures
// ---------------------------------------------------------------------------

const CYAN = '#2ff3ff'

/** The frame it shows: its chains up while a blow is told and lands, its arms down while it asks or stands open. */
export function maximizerSprite(e: Enemy, time: number): string {
  const m = e.ai.mode
  // The fall: a jolt, then down, and down it stays under the second ending's page.
  if (e.dead || (m === 'down' && e.ai.t <= MAXI.fall + MAXI.after - MAXI.jolt)) return 'maxi_down'
  if (m === 'down') return 'maxi_hurt'
  if (m === 'trick') { const own = trickFrame(e); if (own) return own }
  if (m === 'beat' || ((e.ai.hurt as number | undefined) ?? 0) > 0) return 'maxi_hurt'
  if (m === 'reach' || (m === 'blow' && e.ai.t > MAXI.blowRest)) return 'maxi_reach'
  if (m === 'ask' || m === 'open' || m === 'question') return 'maxi_ask'
  return `maxi_${Math.floor(time * 2) % 2}`
}

const boss = (s: GameState) => (s.map.id === 'supplyroom' ? s.map.enemies.find(e => e.kind === 'maximizer' && !e.dead) : undefined)
const stationWord = (st: Station) => WEIGHTS.find(w => w.id === st.weight)!.word

/**
 * A station's disc, two tiles across, its word stamped under it. `lit`: bright brass; `dim` (its Weight still on the
 * way, or no blow of its round landed yet): the same in shadow; `done`: a finished round's, flat grey and empty.
 */
function disc(g: G, x: number, y: number, st: Station, look: 'lit' | 'dim' | 'done') {
  const dim = look === 'dim'
  const done = look === 'done'
  oval(g, x, y + 1, 16, 15, 'rgba(4,2,10,0.55)')
  oval(g, x, y, 15, 14, INK)
  oval(g, x, y, 14, 13, done ? '#8a7444' : dim ? '#6a5428' : BRASS_DARK)
  oval(g, x, y - 1, 13, 12, done ? '#75638c' : dim ? '#97793a' : BRASS)
  // (Spent, it is a flat grey plate with a brass lip: a disc, not a hole.)
  oval(g, x, y, 9, 8, done ? '#655578' : dim ? '#7d632c' : DISH)
  if (done) return
  oval(g, x, y, 7, 6, dim ? '#594619' : BRASS_DARK)
  const word = stationWord(st)
  const w = textWidth(word)
  // (A dark slip under the word, so it reads over a stencil's paint.)
  g.fillStyle = 'rgba(11,6,22,0.85)'
  g.fillRect(Math.round(x - w / 2) - 2, Math.round(y + 16), w + 4, 10)
  drawText(g, word, Math.round(x - w / 2), Math.round(y + 17), dim ? '#d8c8a0' : BRASS_LIGHT, INK)
}

export function drawMaximizerFloor(g: G, s: GameState, cx: number, cy: number, time: number, reduced: boolean) {
  // After the second ending: the one clip nobody counted, where the line says it lies.
  if (s.map.id === 'supplyroom' && has(s, 'maximizer')) g.drawImage(sprite('clip_0'), Math.round(8.5 * T - cx) - 8, Math.round(6.6 * T - cy) - 8)
  const e = boss(s)
  if (!e) return
  // The ring's tiles flash before they stand as piles.
  for (const i of maximizerFlash(s.map, e)) g.drawImage(sprite('clip_floor'), (i % s.map.w) * T - cx, Math.floor(i / s.map.w) * T - cy)
  const st = stationOf(e)
  if (!st) return
  g.save()
  g.globalAlpha = st.fade
  for (const d of st.done) disc(g, Math.round(d.x * T - cx), Math.round(d.y * T - cy), d, 'done')
  const live = st.live
  if (live) {
    const x = Math.round(live.x * T - cx)
    const y = Math.round(live.y * T - cy)
    // (It fades in as its Weight comes down.)
    g.globalAlpha = st.fade * Math.min(1, 0.25 + live.down)
    disc(g, x, y, live, live.lit || live.spent ? 'lit' : 'dim')
    if (live.lit) {
      // The cyan ring: it breathes outward from the disc, over and over.
      const p = reduced ? 0.4 : (time * 0.9) % 1
      for (const [grow, a] of [[1 + p * 7, 1 - p], [1, 1]] as const) {
        g.globalAlpha = st.fade * a * Math.min(1, live.down + 0.2)
        g.fillStyle = CYAN
        const rx = 16 + grow
        const steps = Math.round(rx * 7)
        for (let k = 0; k < steps; k++) {
          const b = (k / steps) * Math.PI * 2
          g.fillRect(Math.round(x + Math.cos(b) * rx - 1), Math.round(y + Math.sin(b) * (rx - 1) - 1), 2, 2)
        }
      }
    }
  }
  g.restore()
  drawTrickFloor(g, s, cx, cy)
}

/** The live station's column of light and its Weight's icon over it at twice the size, coming down as it is called. */
function queueStation(g: G, s: GameState, cx: number, cy: number, items: SceneItem[], lights: Light[], time: number) {
  queueTrick(g, s, cx, cy, items, lights)
  const e = boss(s)
  const live = e ? stationOf(e)?.live : undefined
  if (!live) return
  items.push({
    x: live.x, y: live.y + 0.2, big: true,
    draw: () => {
      const x = Math.round(live.x * T - cx)
      const y = Math.round(live.y * T - cy)
      const up = Math.round((1 - live.down) * 44)
      const was = g.globalAlpha
      if (live.lit) {
        g.fillStyle = CYAN
        for (let k = 0; k < 6; k++) {
          g.globalAlpha = was * (0.42 - k * 0.06) * live.down
          g.fillRect(x - 3, y - (k + 1) * 11, 6, 11)
          g.fillRect(x - 1, y - (k + 1) * 11, 2, 11)
        }
      }
      g.globalAlpha = was * Math.min(1, 0.3 + live.down) * (live.lit || live.spent ? 1 : 0.75)
      const spr = sprite(iconName(live.weight))
      const bob = live.lit ? Math.round(Math.sin(time * 3) * 2) : 0
      // Waiting, it hangs over the disc; once taken it rests in it.
      const foot = y + (live.spent ? 8 : -7) - up + bob
      g.drawImage(spr, x - spr.width, foot - spr.height * 2, spr.width * 2, spr.height * 2)
      g.globalAlpha = was
    },
  })
  if (live.lit) lights.push({ x: live.x, y: live.y, r: 2.4, color: CYAN, a: 0.75 * live.down })
  // (Dim is not dark: in the 8-bit view's dusk an unlit disc would read as a hole.)
  else if (!live.spent) lights.push({ x: live.x, y: live.y, r: 2, color: BRASS_LIGHT, a: 0.55 * live.down })
}

/**
 * A cyan arrow with a dark rim, its tip at (x, y), pointing `way`, `rows` px long: over a hero the machine hides, and
 * at the screen's edge toward a lit station that is past it.
 */
function arrow(g: G, x: number, y: number, way: 'down' | 'up' | 'left' | 'right', rows: number) {
  const along = way === 'left' || way === 'right'
  const sign = way === 'down' || way === 'right' ? 1 : -1
  for (const [grow, color] of [[1, INK], [0, CYAN]] as const) {
    g.fillStyle = color
    // Back from the tip, each row (or column) a px wider on both sides.
    for (let row = -grow; row < rows + grow; row++) {
      const half = Math.max(0, row) + grow
      const at = -sign * row
      if (along) g.fillRect(x + at, y - half, 1, half * 2 + 1)
      else g.fillRect(x - half, y + at, half * 2 + 1, 1)
    }
  }
}

/**
 * A lit station the picture does not hold (a phone sees half the room): an arrow at the edge nearest it. Kept under
 * the HUD at the top and, on an upright screen, above where the thumbs' pads lie.
 */
function stationMark(g: G, s: GameState, place: Place) {
  const e = boss(s)
  const live = e ? stationOf(e)?.live : undefined
  if (!live?.lit) return
  const m = g.getTransform()
  const w = g.canvas.width / (m.a || 1)
  const h = g.canvas.height / (m.d || 1)
  const at = place(live.x, live.y)
  if (at.x > 8 && at.x < w - 8 && at.y > 8 && at.y < h - 8) return
  const x = Math.round(Math.max(5, Math.min(w - 6, at.x)))
  const y = Math.round(Math.max(48, Math.min(h > w ? h * 0.66 : h - 14, at.y)))
  // (Whichever edge it is further past.)
  const overX = Math.max(8 - at.x, at.x - (w - 8))
  const overY = Math.max(8 - at.y, at.y - (h - 8))
  const way = overX >= overY ? (at.x < w / 2 ? 'left' : 'right') : at.y < h / 2 ? 'up' : 'down'
  const bob = Math.floor(s.elapsed * 4) % 2 * 2
  arrow(g, x + (way === 'left' ? bob : way === 'right' ? -bob : 0), y + (way === 'up' ? bob : way === 'down' ? -bob : 0), way, 10)
}

/**
 * A hero the machine's figure hides (it may be walked through): their place is marked over it, a cyan arrow bobbing
 * over where they stand. `flat`: from above.
 */
function behindMark(g: G, s: GameState, place: Place, flat: boolean) {
  const e = boss(s)
  if (!e) return
  const h = s.hero
  // The figure is drawn by its middle from above, by its foot point in the isometric view: who stands further back.
  const behind = flat ? h.y < e.y : h.x + h.y < e.x + e.y + e.r
  if (!behind) return
  const foot = place(e.x, e.y + e.r)
  const at = place(h.x, h.y)
  const x = Math.round(at.x)
  const y = Math.round(at.y)
  if (Math.abs(x - foot.x) > 28 || y - 8 > foot.y || y - 8 < foot.y - 60) return
  arrow(g, x, y - 18 + (Math.floor(s.elapsed * 4) % 2), 'down', 6)
}
