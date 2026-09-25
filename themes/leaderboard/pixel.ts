/**
 * The Hall of Fame as a place in Neon Shrine's world (2026-09-25): the
 * shrine's hall of champions at night. A brick wall with tall arched
 * windows onto the dusk sky (the striped sun low in the big arch), pillars
 * with torches, hanging banners, trophies on pedestals, and under the big
 * arch a stone statue of the hero raising a crystal blade between two
 * crystal braziers. A rose carpet runs from the statue to the viewer.
 *
 * The static hall is painted once per `layout()`; `draw()` blits it and adds
 * what moves: torch flames, embers, the blade's shimmer, the lights. The
 * big arch sits right of centre on wide screens so the ranking panel (left)
 * does not cover it, and in the middle on phones.
 */
import { makeCanvas, type PixelStage } from '../base/pixel/stage'
import { bayer, shade, sprite } from '../base/pixel/sprites'
import { DUSK, drawStars, hash2, paintSun, rect, ditherGradient } from '../base/pixel/scenery'

type G = CanvasRenderingContext2D

const INK = '#0b0616'
const BRICK = '#2a2052'
const BRICK_L = '#352a66'
const BRICK_D = '#1e173e'
const MORTAR = '#150e2c'
const PILLAR = '#3a2f70'
const PILLAR_L = '#4f428f'
const PILLAR_D = '#271f50'

/** The hero in stone, sword raised; 'c'/'w' is the crystal blade, 'k' eyes. */
const STATUE = [
  '...........wX...',
  '...........cX...',
  '...........cX...',
  '...........cX...',
  '...........cX...',
  '...........cX...',
  '...........cX...',
  '...........cX...',
  '..........XXXX..',
  '...........XX...',
  '....XXXX...XX...',
  '...XXXXXX..XX...',
  '...XXXXXX.XXX...',
  '...XkXXkX.XX....',
  '...XXXXXXXXX....',
  '....XXXXXXX.....',
  '..XXXXXXXXX.....',
  '.XXXXXXXXXX.....',
  '.XXXXXXXXXX.....',
  'XXX.XXXXXX......',
  'XX..XXXXXX......',
  'XX..XXXXXX......',
  'XX..XXXXXX......',
  '....XXXXXXX.....',
  '...XXXXXXXX.....',
  '...XXXXXXXXX....',
  '...XXX..XXXX....',
  '...XXX...XXX....',
  '...XXX...XXX....',
  '...XXX...XXX....',
  '..XXXX...XXXX...',
  '..XXXX...XXXX...',
]

const CUP = [
  'XXXXXXXXX',
  'X.XXXXX.X',
  'X.XXXXX.X',
  '.XXXXXXX.',
  '..XXXXX..',
  '...XXX...',
  '....X....',
  '...XXX...',
  '..XXXXX..',
]

const GEM = [
  '..X..',
  '.XXX.',
  'XXXXX',
  'XXXXX',
  '.XXX.',
  '..X..',
]

const CROWN = [
  'X..X..X',
  'XX.X.XX',
  'XXXXXXX',
  'XXXXXXX',
]

const statueRows = shade(STATUE, 'g', 'W', 'G')
const cupRows = shade(CUP, 'y', 'e', 'Y')
const gemRows = shade(GEM, 'c', 'w', 'C')
const crownRows = shade(CROWN, 'y', 'e', 'Y')

interface Torch { x: number; y: number }
interface Trophy { x: number; y: number; color: string }

export function createHallScene() {
  let W = 1
  let H = 1
  let hall: HTMLCanvasElement | null = null
  let sky: HTMLCanvasElement | null = null
  let floorY = 1
  let focusX = 0
  let statueX = 0
  let statueY = 0
  let torches: Torch[] = []
  let braziers: Torch[] = []
  let trophies: Trophy[] = []
  let sunGlow = { x: 0, y: 0 }

  /** An arched window: its outline for both the sky layer and the wall. */
  function archRows(w: number, h: number): { x0: number; x1: number }[] {
    const r = Math.floor(w / 2)
    const out: { x0: number; x1: number }[] = []
    for (let y = 0; y < h; y++) {
      if (y < r) {
        const dy = r - y
        const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy + r * 0.6)))
        out.push({ x0: r - half, x1: r + half + (w % 2) })
      } else out.push({ x0: 0, x1: w })
    }
    return out
  }

  function paintWall(g: G) {
    rect(g, MORTAR, 0, 0, W, floorY)
    const bh = 5
    for (let row = 0; row * bh < floorY; row++) {
      const y = row * bh
      const off = (row % 2) * 7
      for (let x = -off; x < W; x += 14) {
        const n = hash2(x + off, row, 41)
        const col = n > 0.82 ? BRICK_L : n < 0.2 ? BRICK_D : BRICK
        rect(g, col, x + 1, y + 1, 13, bh - 1)
        rect(g, n > 0.82 ? '#43357a' : BRICK_L, x + 1, y + 1, 13, 1)
        if (n > 0.93) rect(g, BRICK_D, x + 4, y + 2, 3, 1)
      }
    }
    // The vault is dark: the top of the wall sinks into the night.
    const fade = Math.round(floorY * 0.4)
    for (let y = 0; y < fade; y++) {
      const t = 1 - y / fade
      for (let x = 0; x < W; x++) {
        if (t * 1.2 - 0.1 > bayer(x, y)) rect(g, INK, x, y)
      }
    }
  }

  function paintWindow(g: G, sg: G, cx: number, top: number, w: number, h: number, sun: boolean) {
    const x = Math.round(cx - w / 2)
    const rows = archRows(w, h)
    // Sky layer: the dusk through the glass.
    const tmp = makeCanvas(w, h)
    const tg = tmp.getContext('2d')!
    ditherGradient(tg, 0, 0, w, h, [DUSK.sky1, DUSK.sky2, DUSK.sky3, DUSK.sky4, DUSK.sky5, DUSK.sky6])
    drawStars(tg, w, Math.round(h * 0.6), 0, 1.4, cx)
    if (sun) {
      const r = Math.max(6, Math.round(w * 0.3))
      paintSun(tg, Math.round(w / 2), Math.round(h * 0.76), r)
      // Far ridge across the sill.
      for (let xx = 0; xx < w; xx++) {
        const top2 = Math.round(h * 0.86 - hash2(Math.floor(xx / 5), 0, 7) * 3 - Math.sin(xx / 7) * 2)
        rect(tg, DUSK.ridgeFar, xx, top2, 1, h - top2)
        rect(tg, DUSK.ridgeFarRim, xx, top2, 1, 1)
      }
      sunGlow = { x: cx, y: top + h * 0.76 }
    } else {
      for (let xx = 0; xx < w; xx++) {
        const top2 = Math.round(h * 0.9 - hash2(Math.floor(xx / 4), 1, cx) * 3)
        rect(tg, DUSK.ridge, xx, top2, 1, h - top2)
        rect(tg, DUSK.ridgeRim, xx, top2, 1, 1)
      }
    }
    // Mullions: a cross of lead.
    rect(tg, INK, Math.floor(w / 2), 0, 1, h)
    if (!sun) rect(tg, INK, 0, Math.round(h * 0.55), w, 1)
    for (let y = 0; y < h; y++) {
      const { x0, x1 } = rows[y]!
      sg.drawImage(tmp, x0, y, x1 - x0, 1, x + x0, top + y, x1 - x0, 1)
    }
    // Frame on the wall: a stone arch round the glass, and a sill.
    for (let y = 0; y < h; y++) {
      const { x0, x1 } = rows[y]!
      rect(g, PILLAR_L, x + x0 - 2, top + y, 2, 1)
      rect(g, PILLAR_D, x + x1, top + y, 2, 1)
      g.clearRect(x + x0, top + y, x1 - x0, 1)
    }
    const r = Math.floor(w / 2)
    for (let i = 0; i < 3; i++) rect(g, PILLAR_L, x - 1 + (r - Math.floor(Math.sqrt(r * r - (r - i) * (r - i)))), top - 2 + i, 2, 1)
    rect(g, PILLAR_L, x + r - 1, top - 3, 3, 2)
    rect(g, PILLAR_L, x - 3, top + h, w + 6, 1)
    rect(g, PILLAR, x - 3, top + h + 1, w + 6, 2)
    rect(g, PILLAR_D, x - 3, top + h + 3, w + 6, 1)
  }

  function paintPillar(g: G, x: number, w: number) {
    const top = 0
    rect(g, PILLAR, x, top, w, floorY - top)
    rect(g, PILLAR_L, x + 1, top, 2, floorY - top)
    rect(g, PILLAR_D, x + w - 2, top, 2, floorY - top)
    rect(g, INK, x - 1, top, 1, floorY - top)
    rect(g, INK, x + w, top, 1, floorY - top)
    for (let y = 8; y < floorY - 6; y += 9) rect(g, PILLAR_D, x + 1, y, w - 2, 1)
    // Base.
    rect(g, PILLAR_L, x - 2, floorY - 6, w + 4, 1)
    rect(g, PILLAR, x - 2, floorY - 5, w + 4, 4)
    rect(g, PILLAR_D, x - 2, floorY - 1, w + 4, 1)
    // A pink neon strip down the middle (lit in the emissive pass).
    rect(g, DUSK.neon, x + Math.floor(w / 2), Math.round(floorY * 0.18), 1, Math.round(floorY * 0.34))
  }

  function paintBanner(g: G, x: number, top: number, w: number, h: number, body: string, dark: string) {
    rect(g, '#140a22', x - 2, top - 1, w + 4, 2)
    rect(g, '#c4861c', x - 3, top - 1, 1, 2)
    rect(g, '#c4861c', x + w + 2, top - 1, 1, 2)
    for (let y = 0; y < h; y++) {
      const notch = Math.max(0, y - (h - Math.floor(w / 2)))
      const mid = Math.floor(w / 2)
      for (let xx = 0; xx < w; xx++) {
        if (notch > 0 && Math.abs(xx - mid + 0.5) < notch) continue
        let c = xx === 0 || xx === w - 1 ? '#ffd23f' : body
        if (xx === w - 2) c = dark
        if (y === 2 || y === h - Math.floor(w / 2) - 2) c = xx === 0 || xx === w - 1 ? '#ffd23f' : '#c4861c'
        rect(g, c, x + xx, top + y, 1, 1)
      }
    }
    // Emblem: a small gold crown.
    const cx = x + Math.floor(w / 2) - 3
    const cy = top + Math.round(h * 0.34)
    for (const [dx, dy] of [[0, 0], [3, 0], [6, 0], [0, 1], [1, 1], [3, 1], [5, 1], [6, 1]]) rect(g, '#ffd23f', cx + dx!, cy + dy!, 1, 1)
    rect(g, '#ffd23f', cx, cy + 2, 7, 2)
    rect(g, '#c4861c', cx, cy + 4, 7, 1)
    rect(g, '#fff1b0', cx + 3, cy + 2, 1, 1)
  }

  function paintPedestal(g: G, cx: number, w: number, h: number): number {
    const x = Math.round(cx - w / 2)
    const top = floorY + 2 - h
    rect(g, INK, x - 2, top - 1, w + 4, h + 1)
    rect(g, PILLAR_L, x - 1, top, w + 2, 1)
    rect(g, PILLAR, x - 1, top + 1, w + 2, 2)
    rect(g, PILLAR_D, x - 1, top + 3, w + 2, 1)
    rect(g, PILLAR, x, top + 4, w, h - 6)
    rect(g, PILLAR_L, x, top + 4, 1, h - 6)
    rect(g, PILLAR_D, x + w - 1, top + 4, 1, h - 6)
    rect(g, PILLAR_L, x - 1, top + h - 2, w + 2, 1)
    rect(g, PILLAR_D, x - 1, top + h - 1, w + 2, 1)
    return top
  }

  function paintFloor(g: G) {
    rect(g, '#1a1336', 0, floorY, W, H - floorY)
    let y = floorY
    let rh = 2
    let row = 0
    while (y < H) {
      const tw = 8 + rh * 3
      const off = (row % 2) * Math.floor(tw / 2) - ((focusX % tw) + tw) % tw
      for (let x = off - tw; x < W + tw; x += tw) {
        const n = hash2(x - off, row, 9)
        const c = (Math.floor((x - off) / tw) + row) % 2 ? '#2a2052' : '#231a46'
        rect(g, n > 0.85 ? '#302560' : c, x + 1, y + 1, tw - 1, rh - 1)
        rect(g, '#3a2f70', x + 1, y + 1, tw - 1, 1)
      }
      y += rh
      rh = Math.min(10, rh + 1)
      row++
    }
    rect(g, INK, 0, floorY, W, 1)
    // The rose carpet: narrow at the statue, wide at the viewer.
    for (let yy = floorY + 1; yy < H; yy++) {
      const t = (yy - floorY) / Math.max(1, H - floorY)
      const half = Math.round(9 + t * 26)
      rect(g, DUSK.pathD, focusX - half - 1, yy, half * 2 + 2, 1)
      rect(g, DUSK.path, focusX - half + 1, yy, half * 2 - 2, 1)
      rect(g, '#ffd23f', focusX - half + 2, yy, 1, 1)
      rect(g, '#ffd23f', focusX + half - 3, yy, 1, 1)
      if (yy % 4 === 0) for (let x = focusX - half + 5; x < focusX + half - 5; x += 6) rect(g, DUSK.pathL, x + (yy % 8 ? 3 : 0), yy, 2, 1)
    }
  }

  function layout(vw: number, vh: number) {
    W = vw
    H = vh
    floorY = Math.round(H * 0.8)
    const wide = W >= 260
    focusX = Math.round(wide ? W * 0.72 : W / 2)
    hall = makeCanvas(W, H)
    sky = makeCanvas(W, H)
    const g = hall.getContext('2d')!
    const sg = sky.getContext('2d')!
    paintWall(g)
    torches = []
    braziers = []
    trophies = []

    // The big arch over the statue, and smaller windows every `step`.
    const bigW = Math.max(34, Math.round(Math.min(W * 0.2, 64)))
    const bigH = Math.round(floorY * 0.62)
    const bigTop = Math.round(floorY * 0.14)
    paintWindow(g, sg, focusX, bigTop, bigW, bigH, true)
    const step = Math.max(bigW + 44, 96)
    const pillarW = 10
    for (const side of [-1, 1]) {
      for (let i = 1; ; i++) {
        const cx = focusX + side * i * step
        if (cx < -40 || cx > W + 40) break
        paintWindow(g, sg, cx, Math.round(floorY * 0.24), 22, Math.round(floorY * 0.44), false)
      }
    }
    // Pillars halfway between windows; torches on them; banners beside.
    let bi = 0
    const banners: [string, string][] = [['#b01874', '#6e0f4a'], ['#54259e', '#351765'], ['#1a6f8a', '#0f4557']]
    for (const side of [-1, 1]) {
      for (let i = 0; ; i++) {
        const px = focusX + side * (step / 2 + i * step)
        if (px < -20 || px > W + 20) break
        paintPillar(g, Math.round(px - pillarW / 2), pillarW)
        torches.push({ x: Math.round(px), y: Math.round(floorY * 0.52) })
        const [b, d] = banners[bi++ % banners.length]!
        const bx = Math.round(px + side * (pillarW / 2 + 8)) - (side < 0 ? 12 : 0)
        paintBanner(g, bx, Math.round(floorY * 0.06), 12, Math.round(floorY * 0.42), b, d)
      }
    }
    paintFloor(g)

    // The statue on its plinth, braziers either side.
    const st = sprite(statueRows)
    const plinthTop = paintPedestal(g, focusX, 26, wide ? Math.round(floorY * 0.2) : 12)
    statueX = Math.round(focusX - st.width / 2 + 1)
    statueY = plinthTop - st.height + 1
    g.drawImage(st, statueX, statueY)
    for (const side of [-1, 1]) {
      const bx = focusX + side * 22
      const top = paintPedestal(g, bx, 8, 14)
      rect(g, INK, bx - 5, top - 4, 10, 4)
      rect(g, '#5a5285', bx - 4, top - 4, 8, 3)
      rect(g, '#8f86b8', bx - 4, top - 4, 8, 1)
      braziers.push({ x: bx, y: top - 5 })
    }
    // The glass round the statue stays lit only where the statue is not.
    sg.globalCompositeOperation = 'destination-out'
    sg.drawImage(st, statueX, statueY)
    sg.globalCompositeOperation = 'source-over'

    // Trophies on pedestals along the floor, away from the carpet.
    const kinds = [cupRows, gemRows, crownRows]
    let k = 0
    for (const side of [-1, 1]) {
      for (let i = 0; ; i++) {
        const cx = focusX + side * (48 + i * Math.round(step / 2))
        if (cx < 8 || cx > W - 8) break
        const rows = kinds[k++ % kinds.length]!
        const top = paintPedestal(g, cx, 10, 16 + (i % 2) * 4)
        const s = sprite(rows)
        g.drawImage(s, Math.round(cx - s.width / 2), top - s.height)
        trophies.push({ x: cx, y: top - Math.round(s.height / 2), color: rows === gemRows ? '#2ff3ff' : '#ffd23f' })
      }
    }
  }

  function flame(g: G, x: number, y: number, t: number, i: number, hot: string, core: string) {
    const f = Math.floor(t * 9 + i * 3) % 3
    rect(g, '#ff2fa0', x - 2, y, 4, 2)
    rect(g, hot, x - 1 - (f === 1 ? 1 : 0), y - 3, 3, 3)
    rect(g, hot, x - (f === 2 ? 1 : 0), y - 5 - (f === 0 ? 1 : 0), 1, 2)
    rect(g, core, x, y - 2, 1, 2)
  }

  function draw(stage: PixelStage, time: number) {
    if (!hall || !sky) return
    const g = stage.g
    g.drawImage(sky, 0, 0)
    stage.emitImage(sky)
    g.drawImage(hall, 0, 0)

    const fl = (i: number) => 0.85 + Math.sin(time * 11 + i * 1.7) * 0.08 + Math.sin(time * 23 + i) * 0.05
    torches.forEach((t, i) => {
      // Bracket.
      rect(g, INK, t.x - 2, t.y, 5, 3)
      rect(g, '#6a4432', t.x - 1, t.y + 1, 3, 1)
      rect(g, '#3a2418', t.x, t.y + 3, 1, 3)
      stage.light(t.x, t.y - 3, 46, '#ff8a3d', 0.9 * fl(i))
      stage.light(t.x, t.y - 3, 14, '#fff1b0', 0.6)
    })
    braziers.forEach((b, i) => {
      stage.light(b.x, b.y - 2, 34, '#2ff3ff', 0.75 * fl(i + 5))
    })
    stage.light(sunGlow.x, sunGlow.y, 60, '#ff2fa0', 0.35)
    stage.light(focusX, statueY + 2, 24, '#2ff3ff', 0.55 + Math.sin(time * 2) * 0.1)
    for (const tr of trophies) stage.light(tr.x, tr.y, 12, tr.color, 0.45)

    // The neon strips on the pillars stay at full brightness.
    for (const t of torches) stage.emit(t.x, Math.round(floorY * 0.18), 1, Math.round(floorY * 0.34))

    stage.present({
      ambient: '#6f5f9e',
      afterLight: (ag) => {
        torches.forEach((t, i) => flame(ag, t.x, t.y - 1, time, i, '#ff8a3d', '#fff1b0'))
        braziers.forEach((b, i) => flame(ag, b.x, b.y, time, i + 7, '#2ff3ff', '#fff4ff'))
        // The crystal blade shimmers: one bright pixel runs up it.
        const run = Math.floor(time * 6) % 12
        if (run < 8) rect(ag, '#fff4ff', statueX + 12, statueY + 8 - run, 1, 1)
        // Embers and crystal motes rising.
        const sources = [...torches.map(t => ({ ...t, c: '#ffd23f' })), ...braziers.map(b => ({ ...b, c: '#7ce4ff' }))]
        sources.forEach((s, si) => {
          for (let j = 0; j < 3; j++) {
            const life = 1.6 + hash2(si, j, 3) * 1.2
            const p = ((time + hash2(si, j, 4) * life) % life) / life
            const x = Math.round(s.x + Math.sin(time * 2 + j + si) * 2 + (hash2(si, j, 5) - 0.5) * 6)
            const y = Math.round(s.y - 6 - p * 26)
            if (p < 0.85) rect(ag, s.c, x, y, 1, 1)
          }
        })
        // Trophy glints now and then.
        trophies.forEach((tr, i) => {
          const ph = (time * 0.7 + i * 0.37) % 3
          if (ph < 0.25) {
            rect(ag, '#fff4ff', tr.x + 2, tr.y - 3, 1, 1)
            if (ph < 0.12) { rect(ag, '#fff4ff', tr.x + 1, tr.y - 3, 3, 1); rect(ag, '#fff4ff', tr.x + 2, tr.y - 4, 1, 3) }
          }
        })
      },
    })
  }

  return { layout, draw }
}
